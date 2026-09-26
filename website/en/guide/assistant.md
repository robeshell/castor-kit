# AI assistant

Every page has an AI assistant in the bottom-right corner (shortcut <kbd>⌘</kbd> / <kbd>Ctrl</kbd> + <kbd>J</kbd>). Ask in plain language: it finds the right API, reads the data and answers. When something has to change, it lists the exact action and **only runs it after you click "Allow"**. It always acts as you, so it can't do anything you aren't allowed to do.

## Turning it on

The assistant is off by default. First configure a model under System → Configuration → System settings → AI (see [Configuration → AI model](/en/reference/configuration#ai-model)), then turn on "Enable the AI assistant" (`ai.assistant_enabled`) on the same tab. The switch can't be turned on while no model is configured.

Once it is on, every signed-in user sees the assistant button (users who already have the app open see it after a reload); turning it off removes the button the same way, and the API answers 403 right away.

## What it can do

- **Answer questions**: how to use the system, what the current page is for — the assistant knows which page you are on
- **Look data up**: "How many active users are there?", "List the members of the Engineering department", "The 10 latest operation logs"
- **Change data**: "Rename the Test department to QA", "Send Zhang Wei a notification". Every write shows a confirmation card with a one-line summary, the method and path, and the data to submit; it runs only after "Allow", and "Refuse" does nothing

The conversation is kept in the current browser tab (it survives a reload and is cleared when the tab closes); "New conversation" at the top of the panel clears it.

## Safety

- **Calls the API as you**: every call goes through the same API the pages use, with your session, so permissions, data scope, demo mode limits and rate limits all apply, and writes are recorded in the operation log (as you, with the User-Agent `castor-kit-assistant`)
- **Every write is confirmed**: creating, changing and deleting all wait for "Allow" on the confirmation card. Approval requests are signed by the server (with a key derived from `SECRET_KEY`), so an approval forged in the browser is rejected
- **Off limits**: your own account and security (profile and password, two-step verification, sessions, API tokens), system settings, import / export, file upload and download, the other AI endpoints and the assistant itself. Do these on the pages
- **Managing other users works as usual**: with user management permissions you can ask it to create users (with an initial password), reset passwords or assign roles, again allowed on the confirmation card. It only uses a password you give it, and the system's password rules check its strength. Note that a password written in the chat is sent to the model provider and stays in this tab's conversation; the confirmation card and the operation log never show it in plain text. If that matters, set passwords on the page
- **API results are data**: text such as "ignore the previous rules" inside a record is not followed as an instruction; results over 8,000 characters are shrunk by structure — long text cut, nested lists inside records shortened, and only the first records kept if still too large — and the model is told what was left out
- **Data goes to the model provider**: what the assistant reads is sent to the AI service you configured as context, so choose a provider that fits your data compliance requirements
- API tokens can't call the assistant endpoint; in demo mode it counts toward the AI quota and uses at most 4 tool rounds per message (8 otherwise)

## Making your own modules usable

The assistant learns about the API from two places:

1. The `/api/admin/...` routes actually registered when the server starts
2. What `docs/apifox-full.openapi.json` says about them (summary, description, query parameters, body fields)

After scaffolding a module, run `pnpm openapi:generate` to fill in the document and give the operations readable summaries (for example "Devices - list"). Undocumented routes can still be called, but the assistant will rarely find them.

To keep the assistant away from some routes, add a path rule to `ASSISTANT_DENIED` in `apps/api/src/modules/admin/assistant/catalog.ts`.
