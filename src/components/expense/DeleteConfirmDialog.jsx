import Dialog from '../ui/Dialog';
import { AlertCircle } from '../ui/Icons';

export default function DeleteConfirmDialog({ open, store, onConfirm, onCancel }) {
  return (
    <Dialog open={open} onClose={onCancel} size="sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-red-100 p-3 rounded-full">
          <AlertCircle className="text-red-600" size={24} />
        </div>
        <h3 className="text-xl font-bold text-slate-900">確認刪除</h3>
      </div>
      <p className="text-slate-600 mb-6">
        確定要刪除「<span className="font-bold text-slate-900">{store}</span>」這筆記錄嗎？
      </p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1">取消</button>
        <button onClick={onConfirm} className="btn-danger flex-1">刪除</button>
      </div>
    </Dialog>
  );
}
