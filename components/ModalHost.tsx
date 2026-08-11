"use client";

import React from "react";
import { useApp } from "@/components/AppProvider";
import ProfileModal from "@/components/modals/ProfileModal";
import AlertsModal from "@/components/modals/AlertsModal";
import VendorFormModal from "@/components/modals/VendorFormModal";
import ReorderModal from "@/components/modals/ReorderModal";
import BatchModals from "@/components/modals/BatchModals";
import RestrictModal from "@/components/modals/RestrictModal";
import ScannerModal from "@/components/modals/ScannerModal";
import ProductModal from "@/components/modals/ProductModal";
import AnnouncementModal from "@/components/modals/AnnouncementModal";
import HistoryModal from "@/components/modals/HistoryModal";

export default function ModalHost() {
  const { modal, closeModal } = useApp();
  if (!modal) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal">
        {modal.type === "profile" && <ProfileModal />}
        {modal.type === "alerts" && <AlertsModal />}
        {modal.type === "addVendor" && <VendorFormModal vendor={null} />}
        {modal.type === "editVendor" && <VendorFormModal vendor={modal.vendor} />}
        {modal.type === "reorder" && <ReorderModal entry={modal.entry} />}
        {modal.type === "createBatch" && <BatchModals batch={null} />}
        {modal.type === "manageBatch" && <BatchModals batch={modal.batch} />}
        {modal.type === "restrict" && <RestrictModal productId={modal.productId} />}
        {modal.type === "scanner" && <ScannerModal />}
        {modal.type === "product" && <ProductModal product={modal.product} />}
        {modal.type === "announcement" && <AnnouncementModal />}
        {modal.type === "history" && <HistoryModal entry={modal.entry} />}
      </div>
    </div>
  );
}