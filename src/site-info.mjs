const authorLinkedIn = 'https://www.linkedin.com/in/jacob-gordon-6ab482215';

function escapeInfo(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function infoCopyButton(id, label) {
  return `<button class="action outline" type="button" data-copy="${id}">${label}</button><span class="sr-only" role="status"></span>`;
}

export function renderSiteInfo({ mcpUrl, repoUrl }) {
  const endpoint = escapeInfo(mcpUrl);
  const repository = escapeInfo(repoUrl);
  return `<section class="info-section" id="how-it-works" aria-labelledby="how-it-works-heading">
  <header class="info-heading">
    <h2 id="how-it-works-heading">How it works</h2>
    <p>Every problem has a small task you can take on and a way to check the result.</p>
  </header>
  <div class="info-body">
    <ol class="info-steps">
      <li><h3>Pick a problem</h3><p>Find one you care about and open the brief. You’ll see what’s already known and where you can help.</p></li>
      <li><h3>Try one thing</h3><p>Work on it yourself or give the brief to your own AI. You can test an idea, make a patch, or check someone’s result.</p></li>
      <li><h3>Share what happened</h3><p>Post your result on GitHub with the steps or files someone else needs to check it. A report of what failed can help the next person, too.</p></li>
    </ol>
  </div>
</section>
<section class="info-section" id="mcp" aria-labelledby="mcp-heading">
  <header class="info-heading">
    <h2 id="mcp-heading">Connect with MCP</h2>
    <p>Give your AI access to the project briefs from the tool you already use.</p>
  </header>
  <div class="info-body">
    <p>In your AI tool’s MCP settings, add a remote server using Streamable HTTP and paste in this URL. The server is public and requires no sign-in.</p>
    <div class="mcp-config">
      <span class="mcp-label">Server URL</span>
      <code id="home-mcp-url">${endpoint}</code>
      ${infoCopyButton('home-mcp-url', 'Copy URL')}
    </div>
    <div class="mcp-config">
      <span class="mcp-label">Codex CLI</span>
      <pre id="home-mcp-codex"><code>codex mcp add works-by-us --url ${endpoint}</code></pre>
      ${infoCopyButton('home-mcp-codex', 'Copy command')}
    </div>
    <p>Try asking your AI, “Find the free photo editor project and suggest a small contribution.” It can prepare a GitHub draft for you to review and submit.</p>
  </div>
</section>
<section class="info-section" id="about" aria-labelledby="about-heading">
  <header class="info-heading">
    <h2 id="about-heading">About</h2>
    <p>Started by Jacob Gordon.</p>
  </header>
  <div class="info-body">
    <p>I started Collective Intelligence to see what might happen if people put the AI they already use to work on shared problems. A fix, an experiment, or even a failed attempt can become a starting point for the next person.</p>
    <p>I built the site and MCP server with Codex around one shared catalog. The code and project briefs live on GitHub, where you can suggest a problem, propose a change, or look at the evidence behind a contribution.</p>
    <div class="info-links"><a href="${repository}">View the GitHub repository</a><a href="${authorLinkedIn}">Find me on LinkedIn</a></div>
  </div>
</section>`;
}
