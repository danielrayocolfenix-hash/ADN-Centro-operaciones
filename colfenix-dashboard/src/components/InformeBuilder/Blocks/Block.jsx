import "../../../css/blocks.css";
export default function Block({
    title, 
    icon,
    children,
    actions,
}) {
    return (
        <div className="ib-block">
            <div className="ib-block-header">
                <div className="ib-block-title">
                    {icon} <span>{title}</span>
                </div>
                {actions}
            </div>
            <div className="ib-block-body">
                {children}
            </div>
        </div>
    );
}