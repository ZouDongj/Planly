import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { useT } from "../../i18n/translations";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  onConfirm: () => void;
}

export default function DeleteConfirmDialog({ open, onOpenChange, taskTitle, onConfirm }: Props) {
  const { __ } = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]" onMouseDown={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-sm">{__("delete.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-[13px] text-muted-foreground">
            {__("delete.confirm")} <span className="font-medium text-foreground">"{taskTitle}"</span>?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted transition-colors"
            >
              {__("delete.cancel")}
            </button>
            <button
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onClick={(e) => { e.stopPropagation(); onConfirm(); onOpenChange(false); }}
              className="px-3 py-1.5 text-xs rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 size={13} />
              {__("delete.delete")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
