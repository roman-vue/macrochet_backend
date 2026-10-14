// Igual que productPath() del front: /productos/<slug>-<id>
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function productPath(product: { _id: unknown; name: string }): string {
  const slug = slugify(product.name);
  return `/productos/${slug ? `${slug}-` : ''}${String(product._id)}`;
}
