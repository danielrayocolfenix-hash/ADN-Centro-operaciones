import { ImagePlus } from "lucide-react";

export default function ImageUploader({ value, onChange }) {
    function upload(ImageFile) {
        if (!ImageFile) return;
        const reader = new FileReader();
        reader.onload = function () {
            onChange(reader.result);
        }
        reader.readAsDataURL(ImageFile);
    }
    return (
        <>
            <label className="btn btn-primary">
                <ImagePlus size={16} />
                Adjuntar evidencia fotográfica
                <input hidden type="file" accept="image/*" onChange={(e) => upload(e.target.files[0])} />
            </label>
            {value && 
                <img src={value} alt="Evidencia fotográfica" style={{maxWidth: "100%", marginTop: 20, borderRadius: 8}} />
            }
        </>
    )
}