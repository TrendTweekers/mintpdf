---
slug: publish-github-action-marketplace
title: Publishing a GitHub Action to the Marketplace, including the parts that surprised me
description: The real sequence for listing an action, the checkbox that stays locked, the tag selection that silently resets, the naming rules that reject more than you expect, and the floating major tag you have to maintain forever.
date: 2026-08-10
---

I listed an action on the GitHub Marketplace this morning. The documented steps are accurate but
thin, and four things cost me time that no page warned me about. Here is the whole sequence, with
those four called out.

## Before you start: what GitHub actually checks

When you tick the Marketplace box, GitHub runs a validation pass and shows you a checklist. In my
case it verified five things:

- **Name** in `action.yml`
- **Description** in `action.yml`
- **Icon** (from `branding.icon`)
- **Color** (from `branding.color`)
- **README** exists

So make sure your metadata has a `branding` block before you begin, or you will bounce off the
validator:

```yaml
name: 'Markdown to PDF (MintPDF)'
description: 'Turn Markdown, HTML or a live URL into a styled PDF. No Chromium to install.'
author: 'MintPDF'

branding:
  icon: 'file-text'
  color: 'green'
```

The icon must be one of the [Feather](https://feathericons.com) icon names and the colour one of a
short fixed list (`white`, `yellow`, `blue`, `green`, `orange`, `red`, `purple`, `gray-dark`).

## Surprise 1: the naming rules reject more than "already taken"

Your action's `name` has to be unique across the whole Marketplace, which everyone expects. Two other
rules are less obvious, and both are in
[GitHub's docs](https://docs.github.com/actions/creating-actions/publishing-actions-in-github-marketplace)
if you read carefully:

- The name **cannot match a GitHub user or organisation**, unless that account is the one publishing.
- The name **cannot match an existing Marketplace category**.

So an action called `Testing` or `Security` is rejected, not because someone took it, but because
those are category names. If you were planning a clean one-word name, plan a second one.

## Surprise 2: one action per repository

Your `action.yml` must be **at the root of the repository**. You can keep other metadata files in
subfolders, but they will not be listed.

That is a structural decision, not a formatting one. If your action lives in a subdirectory of your
main project, it cannot be listed from there. It needs its own repository. I built mine as a separate
repo from the start, which turned out to be luck rather than foresight.

## Surprise 3: the checkbox is locked, and unlocking it resets your form

Go to **Releases**, then **Draft a new release**. At the top you will see **Publish this release to
the GitHub Marketplace** with a padlock, and a line telling you to accept the **GitHub Marketplace
Developer Agreement** first.

Click that link, accept, and you are returned to the release form.

**Your tag selection is now blank again.** The tag dropdown reads "Select tag" as though you had
never chosen one. If you do not notice, GitHub creates a brand new tag off your default branch when
you publish, instead of using the tag you already pushed and tested.

The release notes I had pasted survived. The tag did not. Re-select it before continuing.

## Surprise 4: nested code fences in release notes

I wrote release notes containing a YAML example, pasted them in, published, and the rendered result
had my entire bullet list swallowed into one grey code block.

The cause was mundane: I had composed the notes inside a fenced block that itself contained a fenced
block, and the inner fence closed the outer one. Everything after it was treated as code.

Release notes are the first thing a developer reads on your listing, so it is worth previewing. Use
the **Preview** tab before publishing rather than after, which is what I should have done. Fixing it
afterwards is easy enough:

```bash
gh release edit v1.0.0 --notes-file notes.md
```

## Categories: you get two

A **Primary Category** and one optional second one.

My advice, having looked at what is in each: pick the smallest category that is honestly accurate
rather than the biggest one that is vaguely accurate. `Utilities` contains an enormous number of
actions and a new listing is invisible in it. A narrower category where your action genuinely belongs
gives you a chance of being seen. This is not a trick, it is just that visibility is relative to the
size of the pool.

## Tags: the maintenance nobody mentions

Publish the release against a semver tag, `v1.0.0`.

But users will reference you like this:

```yaml
- uses: owner/action@v1
```

That floating major-version tag is a convention, not something GitHub maintains. **You have to move
it yourself on every release**, or everyone pinned to `@v1` stays frozen on your first version
forever while you happily ship `v1.1.0`.

```bash
git tag -fa v1 -m "v1" v1.2.0
git push origin v1 --force
```

Confirm both resolve to the same commit, because annotated tags point at tag objects rather than
commits and `git ls-remote` output can mislead you:

```bash
git rev-parse v1^{commit}
git rev-parse v1.2.0^{commit}
```

Those two lines should print the same SHA. If they do not, your `@v1` users are on different code
from your release notes.

## There is no review

Actions appear on the Marketplace **immediately**. Nobody at GitHub looks at yours first, as long as
the repository is public and the metadata validates.

That cuts both ways. There is no waiting, and there is also nobody to catch a broken example in your
README before the world sees it. Since publication is instant and permanent-feeling, it is worth
running your own action from a clean workflow once, in a repository that is not the action's own,
before you publish.

Mine has a self-test workflow that asserts the output is a real file and, more usefully, that bad
input makes the action **fail** rather than quietly produce an empty one:

```yaml
- id: missing
  continue-on-error: true
  uses: ./
  with:
    file: does-not-exist.md
- run: test "${{ steps.missing.outcome }}" = "failure"
```

Most action repositories test only the happy path, which is the half that was going to work anyway.

## The sequence, condensed

1. `action.yml` at the repository root, with `branding.icon` and `branding.color`
2. Public repository, with a README
3. Pick a name that is not another action, a user, an organisation, or a category
4. Push a semver tag and a floating major tag
5. Releases, Draft a new release, accept the Developer Agreement
6. **Re-select your tag**, because accepting the agreement cleared it
7. Tick the Marketplace box, choose two categories
8. Preview your release notes, then publish

---

*The action I was listing is
[markdown-to-pdf-action](https://github.com/TrendTweekers/markdown-to-pdf-action), which turns
Markdown into a PDF in CI without installing Chromium on the runner. The reasoning behind it is in
[how to generate a PDF in a GitHub Action](/guides/pdf-github-action). It calls
[MintPDF](https://mintpdf.dev), which I maintain.*
