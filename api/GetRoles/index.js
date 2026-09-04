// Azure Static Web Apps llama esta función justo después de que alguien
// inicia sesión (con cualquier proveedor habilitado) y le pasa los datos
// de esa persona. Aquí decidimos si le damos el rol "admin" o no.
//
// staticwebapp.config.json usa este rol para proteger /admin/*.
//
// Para agregar o quitar quién puede entrar al panel de administrador,
// solo edita esta lista y vuelve a hacer push — no hay que tocar nada más.
const ADMIN_EMAILS = ["alfredo.pina@lifezen.com.mx"];

module.exports = async function (context, req) {
  const userDetails = (req.body && req.body.userDetails) || "";
  const email = userDetails.trim().toLowerCase();

  const roles = ADMIN_EMAILS.includes(email) ? ["admin"] : [];

  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: { roles },
  };
};
