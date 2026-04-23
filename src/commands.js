import document from 'document';
import toolset from './toolset.js';
import { restoreSelection } from './utils.js';
import { execCommand } from './shortcuts.js';

/**
 * Execute an action.
 * @param {string} action The action to execute.
 * @param {object} editor The editor instance.
 * @param {array} [options] Optional action parameters.
 */
export function execAction(action, editor, options = []) {
  const tool = toolset[action];
  
  if (tool) {
    const command = tool.command || action;

    // Restore selection if any
    restoreSelection();

    // Execute the tool's action
    execEditorCommand(command, options);

    // Anchor mutations are direct DOM changes that don't fire an input event,
    // so we dispatch one manually to make updateContent write to the textarea.
    if (command === 'anchor' || command === 'removeAnchor') {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Focus the editor instance
    editor.focus();
  }
}

/**
 * Execute an editor command.
 * @param {string} command The command to execute.
 * @param {array} [options] Optional command parameters.
 */
export function execEditorCommand(command, options) {
  switch (command) {
    // Block level formatting
    case 'quote':
      options[0] = 'blockquote';
    case 'format':
      execCommand('formatBlock', `<${options[0]}>`);
      break;

    // Anchors
    case 'anchor': {
      const [anchorId] = options;
      if (!anchorId) break;

      // Find the block-level element containing the current selection
      const selection = document.getSelection();
      const anchorNode = selection && selection.anchorNode;
      let block = anchorNode instanceof Element ? anchorNode : anchorNode && anchorNode.parentElement;

      while (block && !['P', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'LI'].includes(block.tagName)) {
        block = block.parentElement;
      }

      if (!block) break;

      // Remove any existing anchor placeholder inside the block
      const existing = block.querySelector('a[id]:not([href])');
      if (existing) {
        existing.replaceWith(...existing.childNodes);
      }

      // Insert the new anchor as an empty <a id="..."> at the start of the block
      const anchor = document.createElement('a');
      anchor.id = anchorId;
      block.insertBefore(anchor, block.firstChild);
      break;
    }

    // Remove anchor
    case 'removeAnchor': {
      const selection = document.getSelection();
      const anchorNode = selection && selection.anchorNode;
      let block = anchorNode instanceof Element ? anchorNode : anchorNode && anchorNode.parentElement;

      while (block && !['P', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'LI'].includes(block.tagName)) {
        block = block.parentElement;
      }

      if (!block) break;

      const existing = block.querySelector('a[id]:not([href])');
      if (existing) {
        existing.replaceWith(...existing.childNodes);
      }
      break;
    }

    // Links
    case 'link':
      const [linkUrl, linkTarget = '', linkText] = options;

      if (linkText) {
        const targetAttr = linkTarget !== '' ? ` target="${linkTarget}"` : '';
        const linkTag = `<a href="${linkUrl}"${targetAttr}>${linkText}</a>`;

        execCommand('insertHTML', linkTag);
      }
      break;

    // Images
    case 'image':
      const styles = [];
      const [imageUrl, altText = '', size, position, originalHtml] = options;

      if (size !== '') {
        styles.push(`width: ${size};`);
      }

      if (position !== '') {
        if (position === 'center') {
          styles.push('display: block; margin: auto;')
        } else {
          styles.push(`float: ${position};`);
        }
      }

      const styleAttr = styles.length > 0 ? ` style="${styles.join(' ')}"` : '';
      const image = `<img src="${imageUrl}" alt="${altText}" class="wysi-selected"${styleAttr}>`;
      const imageTag = originalHtml ? originalHtml.replace(/<img[^>]+>/i, image) : image;

      execCommand('insertHTML', imageTag);
      break;

    // All the other commands
    default:
      execCommand(command);
  }
}