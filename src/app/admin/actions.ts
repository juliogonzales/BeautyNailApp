"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canAccess, type AdminSection } from "@/lib/admin-access";
import { getAdminContext } from "@/lib/admin";
import {
  featureEditSchema,
  featureOverrideSchema,
  parseTemplateConfig,
  templateMetaSchema,
  tenantPlanSchema,
  featureSchema,
  grantSchema,
  parseBenefitRows,
  parseGuaranteeRows,
  parseMaterialLines,
  planSchema,
  presetSchema,
  presetSlugSchema,
  specialtySchema,
  tenantStatusSchema,
} from "@/lib/admin-validation";
import { friendlyAdminDbError } from "@/lib/errors";
import { parseWholeNumber } from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";
import { benefitsSchema, guaranteesSchema } from "@/lib/welcome-content";

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** Volta para a tela com um aviso (ok/erro) na URL. `redirect` lança: nunca chame dentro de try/catch. */
function back(path: string, kind: "ok" | "erro", message: string): never {
  revalidatePath(path);
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

/** Toda ação do console: exige login, papel da seção (o banco confere de novo por RLS) e limita a frequência. */
async function gate(section: AdminSection, path: string) {
  const ctx = await getAdminContext();
  if (!ctx.user) redirect("/login?next=/admin");
  if (!ctx.role || !canAccess(ctx.role, section)) back(path, "erro", "Você não tem permissão para isso.");
  if (!rateLimit(`admin:${ctx.user.id}`, 60, 60_000).ok) back(path, "erro", "Muitas ações seguidas. Aguarde um instante.");
  return { supabase: ctx.supabase, user: ctx.user };
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

// ---------------------------------------------------------------- Planos

export async function createPlanAction(formData: FormData) {
  const path = "/admin/planos";
  const { supabase } = await gate("planos", path);
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(path, "erro", firstIssue(parsed.error));
  const d = parsed.data;
  const { data, error } = await supabase
    .from("plans")
    .insert({
      slug: d.slug, name: d.name, description: d.description, price_monthly_cents: d.priceMonthlyCents,
      price_yearly_cents: d.priceYearlyCents, trial_days: d.trialDays, sort_order: d.sortOrder,
      is_public: d.isPublic, is_active: d.isActive,
    })
    .select("id")
    .single();
  if (error || !data) back(path, "erro", friendlyAdminDbError(error?.message));
  redirect(`/admin/planos/${data.id}?ok=${encodeURIComponent("Plano criado. Agora marque os recursos incluídos.")}`);
}

export async function updatePlanAction(formData: FormData) {
  const id = z.string().uuid().safeParse(str(formData, "id"));
  if (!id.success) back("/admin/planos", "erro", "Plano inválido.");
  const path = `/admin/planos/${id.data}`;
  const { supabase } = await gate("planos", path);
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(path, "erro", firstIssue(parsed.error));
  const d = parsed.data;
  const { data, error } = await supabase
    .from("plans")
    .update({
      slug: d.slug, name: d.name, description: d.description, price_monthly_cents: d.priceMonthlyCents,
      price_yearly_cents: d.priceYearlyCents, trial_days: d.trialDays, sort_order: d.sortOrder,
      is_public: d.isPublic, is_active: d.isActive,
    })
    .eq("id", id.data)
    .select("id");
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  if (!data?.length) back(path, "erro", "Plano não encontrado ou sem permissão.");
  back(path, "ok", "Plano salvo.");
}

export async function savePlanFeaturesAction(formData: FormData) {
  const id = z.string().uuid().safeParse(str(formData, "id"));
  if (!id.success) back("/admin/planos", "erro", "Plano inválido.");
  const path = `/admin/planos/${id.data}`;
  const { supabase } = await gate("planos", path);

  const { data: features, error: fError } = await supabase.from("features").select("key, kind");
  if (fError || !features) back(path, "erro", friendlyAdminDbError(fError?.message));

  const rows: Array<{ plan_id: string; feature_key: string; enabled: boolean; limit_value: number | null }> = [];
  for (const f of features) {
    const enabled = formData.get(`enabled:${f.key}`) === "on";
    let limit: number | null = null;
    if (f.kind === "limit" && enabled) {
      const raw = str(formData, `limit:${f.key}`).trim();
      if (raw !== "") {
        const n = parseWholeNumber(raw);
        if (n === null || n > 1_000_000) {
          back(path, "erro", `Limite inválido em "${f.key}". Use um número inteiro ou deixe vazio para ilimitado.`);
        }
        limit = n;
      }
    }
    rows.push({ plan_id: id.data, feature_key: f.key, enabled, limit_value: limit });
  }
  const { error } = await supabase.from("plan_features").upsert(rows, { onConflict: "plan_id,feature_key" });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  back(path, "ok", "Recursos do plano salvos. Vale para todos os negócios nesse plano.");
}

// ---------------------------------------------------------------- Recursos

export async function createFeatureAction(formData: FormData) {
  const path = "/admin/recursos";
  const { supabase } = await gate("recursos", path);
  const parsed = featureSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(path, "erro", firstIssue(parsed.error));
  const d = parsed.data;
  const { error } = await supabase.from("features").insert({
    key: d.key, name: d.name, description: d.description, kind: d.kind,
    unit: d.kind === "limit" ? d.unit : null, sort_order: d.sortOrder,
  });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  back(path, "ok", "Recurso criado e adicionado (desligado) a todos os planos.");
}

export async function updateFeatureAction(formData: FormData) {
  const path = "/admin/recursos";
  const { supabase } = await gate("recursos", path);
  const key = z.string().regex(/^[a-z0-9_]{2,48}$/).safeParse(str(formData, "key"));
  if (!key.success) back(path, "erro", "Recurso inválido.");
  const parsed = featureEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(path, "erro", firstIssue(parsed.error));
  const d = parsed.data;
  const { data, error } = await supabase
    .from("features")
    .update({ name: d.name, description: d.description, unit: d.unit, sort_order: d.sortOrder })
    .eq("key", key.data)
    .select("key");
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  if (!data?.length) back(path, "erro", "Recurso não encontrado ou sem permissão.");
  back(path, "ok", "Recurso salvo.");
}

// ---------------------------------------------------------------- Especialidades

export async function createSpecialtyAction(formData: FormData) {
  const path = "/admin/especialidades";
  const { supabase } = await gate("especialidades", path);
  const parsed = specialtySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(path, "erro", firstIssue(parsed.error));
  const { error } = await supabase
    .from("specialties")
    .insert({ slug: parsed.data.slug, name: parsed.data.name, sort_order: parsed.data.sortOrder });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  back(path, "ok", "Especialidade criada.");
}

export async function updateSpecialtyAction(formData: FormData) {
  const path = "/admin/especialidades";
  const { supabase } = await gate("especialidades", path);
  const id = z.string().uuid().safeParse(str(formData, "id"));
  if (!id.success) back(path, "erro", "Especialidade inválida.");
  const parsed = specialtySchema.omit({ slug: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(path, "erro", firstIssue(parsed.error));
  const { data, error } = await supabase
    .from("specialties")
    .update({
      name: parsed.data.name, sort_order: parsed.data.sortOrder, is_active: formData.get("isActive") === "on",
      calculator_preset: presetSlugSchema.safeParse(str(formData, "calculatorPreset")).data ?? null,
    })
    .eq("id", id.data)
    .select("id");
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  if (!data?.length) back(path, "erro", "Especialidade não encontrada ou sem permissão.");
  back(path, "ok", "Especialidade salva.");
}

// ---------------------------------------------------------------- Textos e nome do produto

export async function saveWelcomeAction(formData: FormData) {
  const path = "/admin/textos";
  const { supabase } = await gate("textos", path);

  const titles = formData.getAll("benefitTitle").map(String);
  const texts = formData.getAll("benefitText").map(String);
  const available = new Set(formData.getAll("benefitAvailable").map((v) => Number(v)).filter((n) => Number.isInteger(n)));
  const benefits = benefitsSchema.safeParse(parseBenefitRows(titles, texts, available));
  if (!benefits.success) back(path, "erro", "Cada benefício precisa de título (até 80) e texto (até 300 caracteres).");
  const guarantees = guaranteesSchema.safeParse(parseGuaranteeRows(formData.getAll("guarantee").map(String)));
  if (!guarantees.success) back(path, "erro", "Cada garantia pode ter até 200 caracteres (máximo de 12).");

  const { error } = await supabase.from("platform_settings").upsert(
    [
      { key: "welcome.benefits", value: benefits.data, is_public: true, description: "Benefícios exibidos na tela Bem-vinda" },
      { key: "welcome.guarantees", value: guarantees.data, is_public: true, description: "Garantias exibidas na tela Bem-vinda" },
    ],
    { onConflict: "key" },
  );
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  revalidatePath("/bem-vinda");
  back(path, "ok", "Textos salvos.");
}

export async function saveProductNameAction(formData: FormData) {
  const path = "/admin/textos";
  const { supabase } = await gate("textos", path);
  const name = z.string().trim().min(2).max(40).safeParse(str(formData, "productName"));
  if (!name.success) back(path, "erro", "O nome do produto deve ter de 2 a 40 caracteres.");
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key: "product.name", value: name.data, is_public: true }, { onConflict: "key" });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  revalidatePath("/", "layout");
  back(path, "ok", "Nome do produto salvo.");
}

// ---------------------------------------------------------------- Negócios

/** Só aceita voltar para a lista de negócios ou para o detalhe de um negócio (evita redirecionamento aberto). */
function safeBackPath(raw: string, fallback: string): string {
  return /^\/admin\/negocios(\/[0-9a-f-]{36})?$/.test(raw) ? raw : fallback;
}

export async function setTenantStatusAction(formData: FormData) {
  const path = safeBackPath(str(formData, "back"), "/admin/negocios");
  const { supabase } = await gate("negocios", path);
  const parsed = tenantStatusSchema.safeParse({
    tenantId: str(formData, "tenantId"), status: str(formData, "status"), reason: str(formData, "reason"),
  });
  if (!parsed.success) back(path, "erro", "Dados inválidos.");
  if (parsed.data.status === "suspended" && parsed.data.reason.length < 3) {
    back(path, "erro", "Informe o motivo da suspensão (fica registrado na auditoria).");
  }
  const { error } = await supabase.rpc("admin_set_tenant_status", {
    p_tenant: parsed.data.tenantId, p_status: parsed.data.status, p_reason: parsed.data.reason,
  });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  back(path, "ok", parsed.data.status === "suspended" ? "Negócio suspenso." : "Negócio reativado.");
}

// ---------------------------------------------------------------- Equipe

export async function grantRoleAction(formData: FormData) {
  const path = "/admin/equipe";
  const { supabase } = await gate("equipe", path);
  const parsed = grantSchema.safeParse({ email: str(formData, "email"), role: str(formData, "role") });
  if (!parsed.success) back(path, "erro", firstIssue(parsed.error));
  const { error } = await supabase.rpc("admin_grant_platform_role", { p_email: parsed.data.email, p_role: parsed.data.role });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  back(path, "ok", "Acesso concedido.");
}

export async function revokeRoleAction(formData: FormData) {
  const path = "/admin/equipe";
  const { supabase } = await gate("equipe", path);
  const id = z.string().uuid().safeParse(str(formData, "userId"));
  if (!id.success) back(path, "erro", "Usuário inválido.");
  const { error } = await supabase.rpc("admin_revoke_platform_role", { p_user: id.data });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  back(path, "ok", "Acesso removido.");
}

// ---------------------------------------------------------------- Gestão de um negócio

export async function setTenantPlanAction(formData: FormData) {
  const parsed = tenantPlanSchema.safeParse({
    tenantId: str(formData, "tenantId"), planId: str(formData, "planId"), reason: str(formData, "reason"),
  });
  if (!parsed.success) back("/admin/negocios", "erro", firstIssue(parsed.error));
  const path = `/admin/negocios/${parsed.data.tenantId}`;
  const { supabase } = await gate("planos", path);
  const { error } = await supabase.rpc("admin_set_tenant_plan", {
    p_tenant: parsed.data.tenantId, p_plan: parsed.data.planId, p_reason: parsed.data.reason,
  });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  back(path, "ok", "Plano alterado. Os recursos já seguem o novo plano.");
}

export async function setFeatureOverrideAction(formData: FormData) {
  const parsed = featureOverrideSchema.safeParse({
    tenantId: str(formData, "tenantId"), key: str(formData, "key"), enabled: str(formData, "enabled"),
    limit: str(formData, "limit"), reason: str(formData, "reason"), expires: str(formData, "expires"),
  });
  if (!parsed.success) back(`/admin/negocios`, "erro", firstIssue(parsed.error));
  const path = `/admin/negocios/${parsed.data.tenantId}`;
  const { supabase } = await gate("planos", path);
  const { error } = await supabase.rpc("admin_set_feature_override", {
    p_tenant: parsed.data.tenantId, p_key: parsed.data.key, p_enabled: parsed.data.enabled,
    p_limit: parsed.data.limit, p_reason: parsed.data.reason, p_expires: parsed.data.expires,
  });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  back(path, "ok", "Exceção salva para este negócio.");
}

export async function clearFeatureOverrideAction(formData: FormData) {
  const tenantId = z.string().uuid().safeParse(str(formData, "tenantId"));
  const key = z.string().regex(/^[a-z0-9_]{2,48}$/).safeParse(str(formData, "key"));
  if (!tenantId.success || !key.success) back("/admin/negocios", "erro", "Dados inválidos.");
  const path = `/admin/negocios/${tenantId.data}`;
  const { supabase } = await gate("planos", path);
  const { error } = await supabase.rpc("admin_clear_feature_override", { p_tenant: tenantId.data, p_key: key.data });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  back(path, "ok", "Exceção removida. O negócio volta a seguir o plano.");
}

// ---------------------------------------------------------------- Modelos de página pública

export async function createTemplateAction(formData: FormData) {
  const path = "/admin/modelos";
  const { supabase } = await gate("modelos", path);
  const entries = Object.fromEntries(formData);
  const meta = templateMetaSchema.safeParse(entries);
  if (!meta.success) back(path, "erro", firstIssue(meta.error));
  const cfg = parseTemplateConfig(entries);
  if (!cfg.ok) back(path, "erro", cfg.error);
  const { data, error } = await supabase
    .from("page_templates")
    .insert({
      slug: meta.data.slug, name: meta.data.name, description: meta.data.description, config: cfg.config,
      sort_order: meta.data.sortOrder, is_active: meta.data.isActive,
    })
    .select("id")
    .single();
  if (error || !data) back(path, "erro", friendlyAdminDbError(error?.message));
  redirect(`/admin/modelos/${data.id}?ok=${encodeURIComponent("Modelo criado.")}`);
}

export async function updateTemplateAction(formData: FormData) {
  const id = z.string().uuid().safeParse(str(formData, "id"));
  if (!id.success) back("/admin/modelos", "erro", "Modelo inválido.");
  const path = `/admin/modelos/${id.data}`;
  const { supabase } = await gate("modelos", path);
  const entries = Object.fromEntries(formData);
  const meta = templateMetaSchema.safeParse(entries);
  if (!meta.success) back(path, "erro", firstIssue(meta.error));
  const cfg = parseTemplateConfig(entries);
  if (!cfg.ok) back(path, "erro", cfg.error);
  const { data: current } = await supabase.from("page_templates").select("is_default").eq("id", id.data).maybeSingle();
  if (current?.is_default && !meta.data.isActive) back(path, "erro", "O modelo padrão não pode ser desativado. Defina outro como padrão antes.");
  const { data, error } = await supabase
    .from("page_templates")
    .update({
      slug: meta.data.slug, name: meta.data.name, description: meta.data.description, config: cfg.config,
      sort_order: meta.data.sortOrder, is_active: meta.data.isActive,
    })
    .eq("id", id.data)
    .select("id");
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  if (!data?.length) back(path, "erro", "Modelo não encontrado ou sem permissão.");
  revalidatePath("/", "layout");
  back(path, "ok", "Modelo salvo. As páginas que usam este modelo já mudaram.");
}

export async function setDefaultTemplateAction(formData: FormData) {
  const id = z.string().uuid().safeParse(str(formData, "id"));
  if (!id.success) back("/admin/modelos", "erro", "Modelo inválido.");
  const path = `/admin/modelos/${id.data}`;
  const { supabase } = await gate("modelos", path);
  const { error } = await supabase.rpc("admin_set_default_template", { p_id: id.data });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  revalidatePath("/", "layout");
  back(path, "ok", "Este modelo agora é o padrão de todos os negócios sem escolha própria.");
}

// ---------------------------------------------------------------- Calculadoras (segmentos)

export async function updateCalculatorPresetAction(formData: FormData) {
  const path = "/admin/calculadoras";
  const { supabase } = await gate("calculadoras", path);
  const slug = presetSlugSchema.safeParse(str(formData, "slug"));
  if (!slug.success) back(path, "erro", "Segmento inválido.");
  const parsed = presetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(path, "erro", firstIssue(parsed.error));
  const { data, error } = await supabase
    .from("calculator_presets")
    .update({
      name: parsed.data.name, description: parsed.data.description, sort_order: parsed.data.sortOrder,
      materials: parseMaterialLines(str(formData, "materials")),
      use_commission: formData.get("useCommission") === "on", is_active: formData.get("isActive") === "on",
    })
    .eq("slug", slug.data)
    .select("slug");
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  if (!data?.length) back(path, "erro", "Segmento não encontrado ou sem permissão.");
  back(path, "ok", "Segmento salvo.");
}

export async function createCalculatorPresetAction(formData: FormData) {
  const path = "/admin/calculadoras";
  const { supabase } = await gate("calculadoras", path);
  const slug = presetSlugSchema.safeParse(str(formData, "slug").toLowerCase());
  if (!slug.success) back(path, "erro", "Slug: 2 a 40 letras minúsculas, números e hífen.");
  const parsed = presetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(path, "erro", firstIssue(parsed.error));
  const { error } = await supabase.from("calculator_presets").insert({
    slug: slug.data, name: parsed.data.name, description: parsed.data.description, sort_order: parsed.data.sortOrder,
    materials: parseMaterialLines(str(formData, "materials")), use_commission: formData.get("useCommission") === "on",
  });
  if (error) back(path, "erro", friendlyAdminDbError(error.message));
  back(path, "ok", "Segmento criado.");
}
