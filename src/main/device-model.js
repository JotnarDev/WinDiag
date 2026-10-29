// Panasonic stores the model with its generation as a suffix ("FZ55-1",
// "CF-33-2", "CF-54-3"); technicians know them as "FZ-55 MK1", "CF-33 MK2".
const PANASONIC_MODEL = /^(CF|FZ)-?([A-Z]?\d+[A-Z]?)-(\d)$/i

/** The name a technician uses for the model, e.g. "FZ-55 MK1"; otherwise the model as is. */
export function friendlyModel(manufacturer, model) {
  if (!model) return model ?? null
  if (!/panasonic/i.test(manufacturer ?? '')) return model
  const match = PANASONIC_MODEL.exec(model.trim())
  return match ? `${match[1].toUpperCase()}-${match[2].toUpperCase()} MK${match[3]}` : model
}
