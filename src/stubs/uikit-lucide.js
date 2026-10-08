// Sustituye a @pmndrs/uikit-lucide (≈4,6 MB: el catálogo completo de íconos para paneles UIKitML de IWSDK).
// IWSDK lo importa con `import * as` solo para listar componentes, y uikit-horizon usa dos íconos por nombre.
// Aquí no hay paneles UIKitML (el menú y la ficha de VR son mallas de Three), así que se exportan solo esos
// dos y el resto del catálogo queda fuera. Si algún día se usan .uikitml con íconos, quitar el alias de vite.config.js.
export { CheckIcon } from '@pmndrs/uikit-lucide/dist/Check.js';
export { ChevronDownIcon } from '@pmndrs/uikit-lucide/dist/ChevronDown.js';
