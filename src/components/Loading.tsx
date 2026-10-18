/** GoCart's spinner (components/Loading.jsx). */
export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-11 h-11 rounded-full border-3 border-gray-300 border-t-green-500 animate-spin" />
    </div>
  );
}
