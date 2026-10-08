# angar

Visor 3D del Centro de Instrucción de Aeronáutica Civil (CIAC) del SENA Atlántico: hangar para 4 aeronaves, bloques de formación y administración, recorrido guiado y modo a pie.

JavaScript puro + Three.js sobre IWSDK, con Vite.

```
npm install
npm run dev      # https://localhost:5173
npm test         # medidas, bloques, visor
npm run check    # geometría, colisiones y salida de aeronaves
```

Las medidas viven en `src/medidas.js`, `src/bloques.js` y `src/predio.js`.
