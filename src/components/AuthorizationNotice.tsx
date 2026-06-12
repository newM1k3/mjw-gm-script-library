import { ShieldAlert } from 'lucide-react';

interface Props {
  title: string;
  message: string;
}

export default function AuthorizationNotice({ title, message }: Props) {
  return (
    <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-4 text-sm text-amber-200 flex items-start gap-3">
      <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div>
        <h2 className="font-semibold text-amber-100">{title}</h2>
        <p className="mt-1 text-amber-200/80">{message}</p>
      </div>
    </div>
  );
}
