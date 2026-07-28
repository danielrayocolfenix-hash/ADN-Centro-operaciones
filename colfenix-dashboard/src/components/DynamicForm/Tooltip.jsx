import { useState } from "react";
import "../../css/tooltip.css";

export default function Tooltip({
    text, 
    children,
    position = "top",
    delay = 200
}) {
    const [ visible, setVisible] = useState(false);
    let timeout;

    function show(){
        timeout = setTimeout(() => {
            setVisible(true);
        }, delay);
    }

    function hide(){
        clearTimeout(timeout);
        setVisible(false);
    }

    return (
        <div className="tooltip-wrapper" onMouseEnter={show} onMouseLeave={hide}>
            {children}
            {visible && (
                <div className={`tooltip-box ${position}`}>
                    {text}
                </div>
            )}
        </div>
    )
}