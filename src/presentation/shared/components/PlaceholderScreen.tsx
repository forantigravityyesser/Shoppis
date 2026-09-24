/** Каркас экрана-заглушки: заголовок + пояснение. Без API. */
export default function PlaceholderScreen({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="screen">
      <div className="screen__header">
        <h1 className="screen__title">{title}</h1>
      </div>
      <div className="card card__muted">{hint ?? 'Раздел появится на следующем этапе'}</div>
    </div>
  );
}
