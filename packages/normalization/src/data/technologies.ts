import type { TechnologyDefinition } from "../types.js";

/**
 * Canonical technology dictionary. This is the single source of truth for alias
 * normalization — `packages/db`'s seed script loads the `Technology` table directly
 * from this file so the pure extraction logic here and the database stay in sync.
 * Adding a technology or alias is a data change here, nothing else.
 *
 * Deliberately omitted for MVP (documented, not an oversight):
 *  - bare single-letter languages ("R", "C") — too ambiguous with ordinary prose to
 *    be worth the false-positive risk versus the value of matching them; C# and .NET
 *    and C++ (via aliases below) are unambiguous and included.
 *  - bare "Claude" as a person's first name is common; only clearly product-referring
 *    phrases are matched (see CLAUDE below).
 */
export const TECHNOLOGIES: TechnologyDefinition[] = [
  { slug: "REACT", displayName: "React", aliases: ["react", "react.js", "reactjs"], category: "FRAMEWORK" },
  { slug: "VUE", displayName: "Vue", aliases: ["vue", "vue.js", "vuejs"], category: "FRAMEWORK" },
  { slug: "ANGULAR", displayName: "Angular", aliases: ["angular", "angularjs"], category: "FRAMEWORK" },
  { slug: "TYPESCRIPT", displayName: "TypeScript", aliases: ["typescript"], category: "LANGUAGE" },
  { slug: "JAVASCRIPT", displayName: "JavaScript", aliases: ["javascript"], category: "LANGUAGE" },
  {
    slug: "NODE_JS",
    displayName: "Node.js",
    aliases: ["node.js", "nodejs", "node js", "node"],
    category: "FRAMEWORK",
  },
  { slug: "PYTHON", displayName: "Python", aliases: ["python"], category: "LANGUAGE" },
  { slug: "JAVA", displayName: "Java", aliases: ["java"], category: "LANGUAGE" },
  { slug: "CSHARP", displayName: "C#", aliases: ["c#", "c-sharp", "csharp"], category: "LANGUAGE" },
  { slug: "CPLUSPLUS", displayName: "C++", aliases: ["c++", "cplusplus"], category: "LANGUAGE" },
  {
    slug: "DOTNET",
    displayName: ".NET",
    aliases: [".net", "dotnet", "asp.net", "dot net"],
    category: "FRAMEWORK",
  },
  { slug: "GOLANG", displayName: "Go", aliases: ["golang"], category: "LANGUAGE" },
  { slug: "RUST", displayName: "Rust", aliases: ["rust"], category: "LANGUAGE" },
  { slug: "PHP", displayName: "PHP", aliases: ["php"], category: "LANGUAGE" },
  {
    slug: "RUBY",
    displayName: "Ruby",
    aliases: ["ruby", "ruby on rails", "rails"],
    category: "LANGUAGE",
  },
  { slug: "AWS", displayName: "AWS", aliases: ["aws", "amazon web services"], category: "CLOUD" },
  { slug: "AZURE", displayName: "Azure", aliases: ["azure", "microsoft azure"], category: "CLOUD" },
  {
    slug: "GCP",
    displayName: "GCP",
    aliases: ["gcp", "google cloud platform", "google cloud"],
    category: "CLOUD",
  },
  { slug: "DOCKER", displayName: "Docker", aliases: ["docker"], category: "TOOLING" },
  { slug: "KUBERNETES", displayName: "Kubernetes", aliases: ["kubernetes", "k8s"], category: "TOOLING" },
  { slug: "TERRAFORM", displayName: "Terraform", aliases: ["terraform"], category: "TOOLING" },
  {
    slug: "POSTGRESQL",
    displayName: "PostgreSQL",
    aliases: ["postgresql", "postgres"],
    category: "DATABASE",
  },
  { slug: "MONGODB", displayName: "MongoDB", aliases: ["mongodb", "mongo"], category: "DATABASE" },
  { slug: "REDIS", displayName: "Redis", aliases: ["redis"], category: "DATABASE" },
  { slug: "KAFKA", displayName: "Kafka", aliases: ["kafka", "apache kafka"], category: "TOOLING" },
  { slug: "SPARK", displayName: "Spark", aliases: ["apache spark", "spark"], category: "TOOLING" },
  { slug: "DATABRICKS", displayName: "Databricks", aliases: ["databricks"], category: "TOOLING" },
  { slug: "PYTORCH", displayName: "PyTorch", aliases: ["pytorch"], category: "AI_ML" },
  { slug: "TENSORFLOW", displayName: "TensorFlow", aliases: ["tensorflow"], category: "AI_ML" },
  {
    slug: "LLM",
    displayName: "LLM",
    aliases: ["llm", "llms", "large language model", "large language models"],
    category: "AI_ML",
  },
  {
    slug: "RAG",
    displayName: "RAG",
    aliases: ["retrieval augmented generation", "retrieval-augmented generation", "rag"],
    category: "AI_ML",
  },
  { slug: "LANGCHAIN", displayName: "LangChain", aliases: ["langchain"], category: "AI_ML" },
  {
    slug: "OPENAI",
    displayName: "OpenAI",
    aliases: ["openai", "open ai", "chatgpt", "gpt-4", "gpt4"],
    category: "AI_ML",
  },
  {
    slug: "CLAUDE",
    displayName: "Claude",
    aliases: ["claude ai", "claude (anthropic)", "anthropic claude", "claude code"],
    category: "AI_ML",
  },
  {
    slug: "AI_AGENTS",
    displayName: "AI Agents",
    aliases: ["ai agents", "autonomous agents", "agentic ai"],
    category: "AI_ML",
  },
];

/** "Go" is real-word-ambiguous; matched only as an exact-case standalone token. */
export const EXACT_CASE_TECHNOLOGY = {
  slug: "GOLANG",
  token: "Go",
};
