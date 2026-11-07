// tools/prueba-calificaciones-espejo.js — el grid de Calificaciones del admin repite a mano la regla de
// api/src/calificaciones-calc.js (para mostrar el resultado en vivo); esta prueba saca esa función del
// admin/index.html y la compara con la del servidor en una malla de combinaciones, para que no se desfasen.
//   node tools/prueba-calificaciones-espejo.js
const fs = require('fs');
const path = require('path');
const { calcularEvaluacion } = require('../api/src/calificaciones-calc');

const html = fs.readFileSync(path.join(__dirname, '..', 'admin', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const ini = html.indexOf('function calcular({ proyecto, asistencias, frecuencias, puntos }){');
const fin = html.indexOf('// analiza una fila del grid', ini);
const lineaConstantes = html.split('\n').find((l) => l.includes('const PESO_PROYECTO = 80'));
if (ini < 0 || fin < 0 || !lineaConstantes) { console.error('No encontré la función calcular() ni sus constantes en admin/index.html'); process.exit(1); }
const calcularAdmin = new Function(lineaConstantes + '\n' + html.slice(ini, fin) + '\nreturn calcular;')();

let fallos = 0, casos = 0;
const proyectos = [0, 30, 50, 60, 70, 74, 75, 76, 79.9, 80, 80.1, 85.5, 95, 100];
const asistencias = [[0, 5], [1, 5], [2, 7], [3, 10], [3, 5], [4, 5], [5, 5], [7, 9], [8, 10], [1, 1], [0, 1]];
const puntos = [0, 0.1, 3.9, 4, 5, 10, 50];
for (const proyecto of proyectos) for (const [a, f] of asistencias) for (const pts of puntos) {
  casos++;
  const e = { proyecto, asistencias: a, frecuencias: f, puntos: pts };
  const s = calcularEvaluacion(e), c = calcularAdmin(e);
  const igual = s.resultado === c.resultado && s.calificacion === c.calificacion && s.asistenciaPct === c.asistenciaPct && s.excede100 === c.excede100 && s.cumpleProyecto === c.cumpleProyecto && s.cumpleAsistencia === c.cumpleAsistencia;
  if (!igual) { fallos++; if (fallos <= 10) console.log('  FALLA', JSON.stringify(e), 'servidor:', s.resultado, s.calificacion, '| admin:', c.resultado, c.calificacion); }
}
console.log((fallos ? '  FALLA ' : '  OK ') + 'el cálculo del admin coincide con el del servidor en ' + casos + ' combinaciones' + (fallos ? ' (' + fallos + ' difieren)' : ''));
console.log(fallos ? '\n' + fallos + ' FALLARON' : '\nCalificaciones: el admin y el servidor aplican la misma regla');
process.exit(fallos ? 1 : 0);
