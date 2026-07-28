import {Route} from "lucide-react";
import Block from "./Block";
import CheckboxNoAplica from "../Checkboxs/CheckboxNoAplica";
import ImageUploader from "../Editor/ImageUploader";
import TipTapEditor from "../Editor/TipTapEditor";

export default function RecorridoBlock({value, onChange}) {
    function update(field, data){
        onChange({
            ...value,
            [field]: data
        });
    }
    return (
        <Block title="Recorrido" icon={<Route size={18} />}>
            <CheckboxNoAplica checked={value.noAplica} onChange={(v)=>update('noAplica', v)} />
            {
                !value.noAplica && (
                    <>
                        <div className="ib-field">
                            <label>Descripción del recorrido</label>
                            <TipTapEditor value={value.texto} placeholder="Describe el recorrrido realizado..." onChange={(v)=>update("texto", v)}/>
                        </div>
                        <div className="ib-field">
                            <label>Imagen del recorrido</label>
                            <ImageUploader value={value.imagen} onChange={(v)=>update("imagen", v)}/>
                        </div>
                    </>
                )
            }
        </Block>
    );
}