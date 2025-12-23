import { Root, RootContent } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { toString } from 'mdast-util-to-string';
import { u } from 'unist-builder';

export type Json = Record<
  string,
  string | number | boolean | null | Json[] | { [key: string]: Json }
>;

export type Section = {
  content: string;
  heading?: string;
  part?: number;
  total?: number;
};

export type ProcessedMd = {
  sections: Section[];
};

/**
 * Splits a `mdast` tree into multiple trees based on
 * a predicate function. Will include the splitting node
 * at the beginning of each tree.
 *
 * Useful to split a markdown file into smaller sections.
 */
export function splitTreeBy(
  tree: Root,
  predicate: (node: RootContent) => boolean
) {
  return tree.children.reduce<Root[]>((trees, node) => {
    const [lastTree] = trees.slice(-1);

    if (!lastTree || predicate(node)) {
      const tree: Root = u('root', [node]);
      return trees.concat(tree);
    }

    lastTree.children.push(node);
    return trees;
  }, []);
}

/**
 * Splits markdown content by heading for embedding indexing.
 * Keeps heading in each chunk.
 *
 * If a section is still greater than `maxSectionLength`, that section
 * is chunked into smaller even-sized sections (by character length).
 */
export function processMarkdown(
  content: string,
  maxSectionLength = 2500,
  minSectionLength = 200  // NEW: Minimum chunk size to avoid tiny fragments
): ProcessedMd {
  const mdTree = fromMarkdown(content);

  if (!mdTree) {
    return {
      sections: [],
    };
  }

  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === 'heading');

  // First pass: convert trees to sections with content
  let rawSections = sectionTrees.map((tree) => {
    const [firstNode] = tree.children;
    const content = toMarkdown(tree);
    const heading =
      firstNode.type === 'heading' ? toString(firstNode) : undefined;

    return { content, heading };
  });

  // Second pass: merge sections that are too small
  const mergedSections: Section[] = [];
  let currentSection: Section | null = null;

  for (const section of rawSections) {
    if (!currentSection) {
      currentSection = section;
      continue;
    }

    // If current section is too small, merge with next
    if (currentSection.content.length < minSectionLength) {
      currentSection = {
        content: currentSection.content + '\n\n' + section.content,
        heading: currentSection.heading || section.heading,
      };
    } else {
      // Current section is good, save it and start new one
      mergedSections.push(currentSection);
      currentSection = section;
    }
  }

  // Don't forget the last section
  if (currentSection) {
    mergedSections.push(currentSection);
  }

  // Third pass: chunk sections if they are too large
  const sections = mergedSections.flatMap<Section>((section) => {
    if (section.content.length > maxSectionLength) {
      const numberChunks = Math.ceil(section.content.length / maxSectionLength);
      const chunkSize = Math.ceil(section.content.length / numberChunks);
      const chunks = [];

      for (let i = 0; i < numberChunks; i++) {
        chunks.push(section.content.substring(i * chunkSize, (i + 1) * chunkSize));
      }

      return chunks.map((chunk, i) => ({
        content: chunk,
        heading: section.heading,
        part: i + 1,
        total: numberChunks,
      }));
    }

    return section;
  });

  return {
    sections,
  };
}
