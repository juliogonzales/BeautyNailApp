"use client";

import { useState } from "react";

type Props = { url: string; displayUrl: string; whatsappShareHref: string; qrSvg: string; businessName: string };

/** Link público do negócio: abrir, copiar, compartilhar no WhatsApp e QR code. */
export function ShareLinkCard({ url, displayUrl, whatsappShareHref, qrSvg, businessName }: Props) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied("idle"), 2500);
  }

  const btn =
    "rounded-lg border border-sand bg-white px-3 py-2.5 text-center text-sm font-medium text-cocoa hover:bg-nude focus:outline-none focus:ring-2 focus:ring-cocoa";

  return (
    <section className="rounded-xl border border-sand bg-white p-5" aria-labelledby="link-title">
      <h2 id="link-title" className="text-sm uppercase tracking-widest text-gold">
        Seu link
      </h2>
      <p className="mt-2 break-all font-serif text-xl text-cocoa">{displayUrl}</p>
      <p className="mt-1 text-sm text-graphite/80">Coloque na bio do Instagram e envie para suas clientes.</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <a href={url} target="_blank" rel="noopener noreferrer" className={btn}>
          Abrir meu site
        </a>
        <button type="button" onClick={copy} className={btn}>
          {copied === "ok" ? "Link copiado!" : copied === "fail" ? "Copie manualmente" : "Copiar link"}
        </button>
        <a href={whatsappShareHref} target="_blank" rel="noopener noreferrer" className={`${btn} col-span-2 sm:col-span-1`}>
          Enviar no WhatsApp
        </a>
      </div>
      <p role="status" className="sr-only">
        {copied === "ok" ? "Link copiado" : ""}
      </p>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-cocoa underline">Mostrar QR code</summary>
        <div className="mt-3 flex flex-col items-center gap-2">
          <div
            role="img"
            aria-label={`QR code para ${businessName}`}
            className="h-44 w-44 rounded-lg border border-sand bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="text-xs text-graphite/70">Aponte a câmera do celular para abrir sua página.</p>
        </div>
      </details>
    </section>
  );
}
