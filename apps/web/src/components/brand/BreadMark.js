import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function BreadMark({ size = 100, color = '#E3AC3F', reduced = false, side = 0.5, strong = 1, }) {
    if (reduced) {
        return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 100 100", role: "img", "aria-label": "Cheirin de P\u00E3o", children: [_jsx("path", { d: "M20 80 C20 56 33 46 50 46 C67 46 80 56 80 80", fill: "none", stroke: color, strokeWidth: "12", strokeLinecap: "round" }), _jsx("path", { d: "M50 46 C44 36 56 31 50 20", fill: "none", stroke: color, strokeWidth: "9", strokeLinecap: "round" })] }));
    }
    return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 100 100", role: "img", "aria-label": "Cheirin de P\u00E3o", children: [_jsx("path", { d: "M22 80 C22 58 34 48 50 48 C66 48 78 58 78 80", fill: "none", stroke: color, strokeWidth: "8", strokeLinecap: "round", opacity: strong }), _jsx("path", { d: "M50 48 C45 39 55 34 50 24", fill: "none", stroke: color, strokeWidth: "5.5", strokeLinecap: "round", opacity: strong }), _jsx("path", { d: "M36 52 C32 45 39 41 36 34", fill: "none", stroke: color, strokeWidth: "4.5", strokeLinecap: "round", opacity: side }), _jsx("path", { d: "M64 52 C60 45 67 41 64 34", fill: "none", stroke: color, strokeWidth: "4.5", strokeLinecap: "round", opacity: side })] }));
}
