import sinon from "sinon";

export function initLog() {
  const DISABLE_LOGGING = !process.env.LOG;
  if (DISABLE_LOGGING) {
    console.log("DISABLED LOGGING");
    sinon.stub(console, "log");
    sinon.stub(console, "error");
    sinon.stub(console, "warn");
    sinon.stub(console, "info");
  }
}
