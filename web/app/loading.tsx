export default function Loading() {
  return (
    <div className="space-y-3 py-10" aria-label="Loading">
      <div className="h-8 w-2/3 skeleton" />
      <div className="h-4 w-full skeleton" />
      <div className="h-4 w-5/6 skeleton" />
      <div className="mt-6 h-40 w-full skeleton" />
    </div>
  );
}
