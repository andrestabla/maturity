export function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dateString}T12:00:00`));
}

export function formatLongDate(dateString: string) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${dateString}T12:00:00`));
}

export function formatPageDate(date = new Date()) {
  const label = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}
