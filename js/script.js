const API_URL = "https://last-airbender-api.fly.dev/api/v1/characters";
const CLAVE_FAVORITOS = "avatar-favoritos";
const IMAGEN_RESPALDO = "https://placehold.co/400x400?text=Sin+imagen";

// Elementos de la página
const contenedor = document.getElementById("personajes");
const mensaje = document.getElementById("mensaje");
const resumen = document.getElementById("resumen");
const formBusqueda = document.getElementById("formBusqueda");
const inputBusqueda = document.getElementById("inputBusqueda");
const checkVariantes = document.getElementById("ocultarVariantes");
const contadorFavoritos = document.getElementById("contadorFavoritos");
const botonesVista = document.querySelectorAll(".vista");
const botonesNacion = document.querySelectorAll(".nacion");

// Estado de la aplicación
let personajes = [];          // últimos resultados recibidos de la API
let favoritos = leerFavoritos();
let vistaActual = "todos";    // "todos" o "favoritos"
let nacionActual = "todas";
let numeroPeticion = 0;       // evita que una búsqueda vieja reemplace a una nueva

// ---------- Conexión con la API ----------

async function cargarPersonajes(nombre) {
  const peticion = ++numeroPeticion;
  let url = API_URL + "?perPage=500";
  if (nombre) {
    url += "&name=" + encodeURIComponent(nombre);
  }

  mostrarMensaje("Cargando personajes...");
  contenedor.innerHTML = "";
  resumen.textContent = "";

  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      throw new Error("La API respondió con el código " + respuesta.status);
    }
    const datos = await respuesta.json();

    if (peticion !== numeroPeticion) return; // ya hay una búsqueda más reciente
    personajes = datos;
    mostrarMensaje("");
    render();
  } catch (error) {
    if (peticion !== numeroPeticion) return;
    console.error(error);
    personajes = [];
    mostrarMensaje("No se pudo conectar con la API de Avatar. Revisa tu conexión o intenta más tarde.", true);
  }
}

// ---------- Filtros ----------

// Deduce las naciones a partir del texto de afiliación
function obtenerNaciones(personaje) {
  const texto = (personaje.affiliation || "").toLowerCase();
  const naciones = [];

  if (texto.includes("water")) naciones.push("agua");
  if (texto.includes("earth") || texto.includes("ba sing se") || texto.includes("dai li")) naciones.push("tierra");
  // "fire nation" y no solo "fire", para no confundir equipos como los "Fire Ferrets"
  if (texto.includes("fire nation") || texto.includes("fire sage")) naciones.push("fuego");
  if (texto.includes("air nomad") || texto.includes("air acolyte") || texto.includes("air nation")) naciones.push("aire");

  return naciones;
}

// Las versiones alternas tienen paréntesis en el nombre, ej. "Aang (games)"
function esVariante(personaje) {
  return personaje.name.includes("(");
}

function aplicarFiltros(lista) {
  return lista.filter(function (p) {
    if (checkVariantes.checked && esVariante(p)) return false;

    const naciones = obtenerNaciones(p);
    if (nacionActual === "otros") return naciones.length === 0;
    if (nacionActual !== "todas") return naciones.includes(nacionActual);
    return true;
  });
}

// ---------- Mostrar en pantalla ----------

function render() {
  let lista;

  if (vistaActual === "favoritos") {
    // En favoritos la búsqueda se hace localmente, sin llamar a la API
    const texto = inputBusqueda.value.trim().toLowerCase();
    lista = favoritos.filter(function (p) {
      return p.name.toLowerCase().includes(texto);
    });
  } else {
    lista = personajes;
  }

  const filtrados = aplicarFiltros(lista);
  contenedor.innerHTML = "";

  if (filtrados.length === 0) {
    resumen.textContent = "";
    if (vistaActual === "favoritos" && favoritos.length === 0) {
      mostrarMensaje("Aún no tienes favoritos. Pulsa el 🤍 de un personaje para guardarlo.");
    } else {
      mostrarMensaje("No se encontraron personajes con esa búsqueda o filtro.");
    }
    return;
  }

  mostrarMensaje("");
  resumen.textContent = "Mostrando " + filtrados.length + " personaje(s)";
  filtrados.forEach(function (p) {
    contenedor.appendChild(crearTarjeta(p));
  });
}

function crearTarjeta(p) {
  const naciones = obtenerNaciones(p);
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta " + (naciones[0] || "otros");

  const img = document.createElement("img");
  img.src = p.photoUrl || IMAGEN_RESPALDO;
  img.alt = p.name;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.addEventListener("error", function () {
    img.src = IMAGEN_RESPALDO;
  }, { once: true });

  const etiquetas = naciones.length
    ? naciones.map(function (n) { return '<span class="etiqueta ' + n + '">' + nombreNacion(n) + "</span>"; }).join("")
    : '<span class="etiqueta">Sin nación</span>';

  const info = document.createElement("div");
  info.className = "info";
  info.innerHTML =
    "<h3>" + escapar(p.name) + "</h3>" +
    '<div class="etiquetas">' + etiquetas + "</div>" +
    "<p><strong>Afiliación:</strong> " + escapar(p.affiliation ? p.affiliation.trim() : "Desconocida") + "</p>" +
    "<p><strong>Aliados:</strong> " + escapar(listaTexto(p.allies)) + "</p>" +
    "<p><strong>Enemigos:</strong> " + escapar(listaTexto(p.enemies)) + "</p>";

  const boton = document.createElement("button");
  boton.className = "btn-favorito";
  const favorito = esFavorito(p);
  boton.textContent = favorito ? "❤️" : "🤍";
  boton.title = favorito ? "Quitar de favoritos" : "Agregar a favoritos";
  boton.addEventListener("click", function () {
    alternarFavorito(p);
  });

  tarjeta.append(img, boton, info);
  return tarjeta;
}

function mostrarMensaje(texto, esError) {
  mensaje.textContent = texto;
  mensaje.classList.toggle("error", Boolean(esError));
}

function nombreNacion(n) {
  return { agua: "💧 Agua", tierra: "⛰️ Tierra", fuego: "🔥 Fuego", aire: "🌪️ Aire" }[n];
}

function listaTexto(lista) {
  return lista && lista.length ? lista.join(", ") : "Ninguno";
}

// Evita que texto de la API se interprete como HTML
function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// ---------- Favoritos (localStorage) ----------

function leerFavoritos() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_FAVORITOS)) || [];
  } catch (error) {
    return [];
  }
}

function guardarFavoritos() {
  localStorage.setItem(CLAVE_FAVORITOS, JSON.stringify(favoritos));
  contadorFavoritos.textContent = favoritos.length;
}

function esFavorito(p) {
  return favoritos.some(function (f) { return f._id === p._id; });
}

function alternarFavorito(p) {
  if (esFavorito(p)) {
    favoritos = favoritos.filter(function (f) { return f._id !== p._id; });
  } else {
    favoritos.push(p);
  }
  guardarFavoritos();
  render();
}

// ---------- Eventos ----------

formBusqueda.addEventListener("submit", function (evento) {
  evento.preventDefault();
  if (vistaActual === "favoritos") {
    render();
  } else {
    cargarPersonajes(inputBusqueda.value.trim());
  }
});

// Si se borra el buscador, se vuelven a mostrar todos
inputBusqueda.addEventListener("search", function () {
  if (inputBusqueda.value === "") formBusqueda.requestSubmit();
});

botonesNacion.forEach(function (boton) {
  boton.addEventListener("click", function () {
    botonesNacion.forEach(function (b) { b.classList.remove("activa"); });
    boton.classList.add("activa");
    nacionActual = boton.dataset.nacion;
    render();
  });
});

botonesVista.forEach(function (boton) {
  boton.addEventListener("click", function () {
    botonesVista.forEach(function (b) { b.classList.remove("activa"); });
    boton.classList.add("activa");
    vistaActual = boton.dataset.vista;
    render();
  });
});

checkVariantes.addEventListener("change", render);

// ---------- Inicio ----------

contadorFavoritos.textContent = favoritos.length;
cargarPersonajes();
