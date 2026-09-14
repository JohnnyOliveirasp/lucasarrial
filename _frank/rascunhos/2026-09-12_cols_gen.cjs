const { supa } = require("../ferramentas/_comum.cjs");
(async () => {
  const db = supa();
  const { data, error } = await db.from("generations").select("*").eq("status","failed").order("created_at",{ascending:false}).limit(1);
  if (error) return console.log("ERRO:", error.message);
  console.log("COLUNAS:", Object.keys(data[0]).join(", "));
  console.log("\nAMOSTRA:", JSON.stringify(data[0]).slice(0,1200));
})();
