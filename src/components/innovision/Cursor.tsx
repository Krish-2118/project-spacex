
/** Custom cursor ring and dot used on the home page. */
export default function Cursor() {
  return (
    <>
      <div data-cursor="" aria-hidden="true" style={{ position: "fixed", left: "0", top: "0", zIndex: "96", width: "46px", height: "46px", margin: "-23px 0 0 -23px", border: "1.5px solid #fff", borderRadius: "50%", mixBlendMode: "difference", pointerEvents: "none", opacity: "0" }}></div>
      <div data-cursor-dot="" aria-hidden="true" style={{ position: "fixed", left: "0", top: "0", zIndex: "96", width: "6px", height: "6px", margin: "-3px 0 0 -3px", borderRadius: "50%", background: "#fff", mixBlendMode: "difference", pointerEvents: "none", opacity: "0" }}></div>
    </>
  );
}
