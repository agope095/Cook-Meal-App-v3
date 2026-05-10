import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "warning"
}: ConfirmationModalProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Enter') {
      onConfirm();
    }
  };

  const variantStyles = {
    danger: {
      icon: "bg-red-100 text-red-600",
      confirmButton: "bg-red-600 hover:bg-red-700 text-white",
      iconComponent: AlertTriangle
    },
    warning: {
      icon: "bg-amber-100 text-amber-600",
      confirmButton: "bg-amber-600 hover:bg-amber-700 text-white",
      iconComponent: AlertTriangle
    },
    info: {
      icon: "bg-blue-100 text-blue-600",
      confirmButton: "bg-blue-600 hover:bg-blue-700 text-white",
      iconComponent: AlertTriangle
    }
  };

  const styles = variantStyles[variant];
  const IconComponent = styles.iconComponent;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>

            <div className="flex items-start gap-4 mb-6">
              <div className={`p-3 rounded-2xl shrink-0 ${styles.icon}`}>
                <IconComponent size={24} />
              </div>
              <div>
                <h3 id="modal-title" className="text-lg font-bold text-gray-900 mb-2">
                  {title}
                </h3>
                <p className="text-gray-600">{message}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${styles.confirmButton}`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}