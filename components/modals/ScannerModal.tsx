"use client";

import React, { useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";

export default function ScannerModal() {
  const { products, closeModal, openModal } = useApp();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const startedRef = useRef(false);
  const matchedRef = useRef(false);

  React.useEffect(() => {
    let scanner: { stop: () => Promise<void> } | null = null;
    let cancelled = false;

    const start = async () => {
      if (startedRef.current || cancelled) return;
      startedRef.current = true;
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const html5QrCode = new Html5Qrcode("qr-reader");
        scanner = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            if (cancelled || matchedRef.current) return;
            setMessage(`Scanned: ${decodedText}`);
            const product = products.find(
              (p) => p.barcode === decodedText || p.sku === decodedText
            );
            if (product) {
              matchedRef.current = true;
              setMessage(`✓ ${product.name} (SKU ${product.sku}) — opening…`);
              setTimeout(() => {
                if (!cancelled) openModal({ type: "product", product });
              }, 500);
            } else {
              setError(`"${decodedText}" not found in SKU catalog`);
            }
          },
          () => {
            /* keep scanning */
          }
        );
      } catch (err) {
        setError((err as Error).message || "Camera access failed");
        startedRef.current = false;
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (scanner) {
        void scanner.stop().catch(() => {});
        scanner = null;
      }
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <button className="modal-close" onClick={closeModal}>
        ×
      </button>
      <h3>Barcode Scanner</h3>
      <p className="modal-sub">Point camera at a product barcode.</p>
      <div id="qr-reader" style={{ minHeight: 220 }} />
      {message && (
        <p style={{ color: "#2F6B4F", fontWeight: 600, fontSize: 13 }}>{message}</p>
      )}
      {error && (
        <p style={{ color: "#B8722A", fontWeight: 600, fontSize: 13 }}>{error}</p>
      )}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={closeModal}>
          Close
        </button>
      </div>
    </div>
  );
}