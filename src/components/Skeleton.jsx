/** Generic skeleton loader — pass className for sizing */
export default function Skeleton({ className = "", style = {} }) {
  return (
    <div
      className={`rounded-lg animate-pulse ${className}`}
      style={{ background: "rgba(255,255,255,0.05)", ...style }}
    />
  );
}

export function CollectionRowSkeleton() {
  return (
    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.025)" }}>
      {[40, 200, 100, 100, 80, 100].map((w, i) => (
        <td key={i} className="py-3.5 px-4">
          <Skeleton style={{ width: w, height: 16 }} />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <Skeleton style={{ height: 180 }} />
      <div className="p-3 flex flex-col gap-2">
        <Skeleton style={{ height: 14, width: "70%" }} />
        <Skeleton style={{ height: 14, width: "40%" }} />
      </div>
    </div>
  );
}
