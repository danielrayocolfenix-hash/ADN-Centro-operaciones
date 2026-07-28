import { Map } from "lucide-react";
import Block from "./Block";
import CheckboxNoAplica from "../Checkboxs/CheckboxNoAplica";
import ImageUploader from "../Editor/ImageUploader";

export default function LogioxBlock({value, onChange}) {
  function update(field, data){
    onChange({
      ...value,
      [field]: data
    });
  }

  return (
    <Block
      title="Logiox"
      icon={<Map size={18} />}
    >

    <CheckboxNoAplica
        checked={value.noAplica}
        onChange={(v) =>update('noAplica', v)}
    />
    {
        !value.noAplica && (
            <>
                <EditableTable
                    columns={value.columnas}
                    rows={value.filas}
                    onColumnsChange={(v) => update('columnas', v)}
                    onRowsChange={(v) => update('filas', v)}
                />

                <div style={{marginTop:20}}>
                    <ImageUploader value={value.imagen} onChange={(v) => update('imagen', v)} />
                </div>
            </>
        )
    }
    </Block>
  );
}
