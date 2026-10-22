/** Close the isolated server directly; Windows process-tree termination can stall in restricted shells. */
export default async function teardown() {
  await fetch('http://127.0.0.1:3191/__shutdown', { method: 'POST' }).catch(() => {});
}
