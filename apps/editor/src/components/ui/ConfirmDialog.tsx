import { t } from '../../i18n';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.title}
      footer={
        <>
          <button type="button" class="sam-btn" onClick={() => props.onOpenChange(false)}>
            {t("Cancel")} </button>
          <button
            type="button"
            class="sam-btn"
            classList={{ danger: props.danger, primary: !props.danger }}
            onClick={() => {
              props.onConfirm();
              props.onOpenChange(false);
            }}
          >
            {props.confirmLabel ?? t("Confirm")}
          </button>
        </>
      }
    >
      <p class="text-[13px] text-[#303030] leading-relaxed">{props.message}</p>
    </Modal>
  );
}
