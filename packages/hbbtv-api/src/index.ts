function hello(): void {
  console.log("HbbTV APIs injected successfully");
}

const hbbtvApi = {
  api_hello: hello,
  api_version: "1.0.0",
};

export { hbbtvApi };
export default hbbtvApi;
