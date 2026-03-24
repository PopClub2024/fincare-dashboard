interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-[22px] font-semibold" style={{ color: "#2C3E50" }}>{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: "#666666" }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
