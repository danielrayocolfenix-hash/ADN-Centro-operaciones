import LogioxBlock from "../Blocks/LogioxBlock";
import RecorridoBlock from "../Blocks/RecorridoBlock";

export default function PositivoForm({value, onChange}) {
    function update(field, data){
        onChange({
            ...value,
            [field]: data
        });
    }
    return (
        <>
            <LogioxBlock value={data.logiox} onChange={(v)=>update("logiox", v)}/>
            <RecorridoBlock value={data.recorrido} onChange={(v)=>update("recorrido", v)}/>
        </>
    )    
}