import type { JSX } from 'react';
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { EntityRefLink } from '@backstage/plugin-catalog-react';

export type SerializedMentionNode = Spread<
  { entityRef: string; label: string },
  SerializedLexicalNode
>;

function MentionComponent(props: { entityRef: string; label: string }) {
  const editable = useLexicalEditable();
  if (editable) {
    // while editing the token is highlighted but not navigable, so a
    // click places the cursor instead of leaving the drawer
    return <span className="brt-mention">{props.label}</span>;
  }
  return (
    <span className="brt-mention">
      <EntityRefLink entityRef={props.entityRef}>{props.label}</EntityRefLink>
    </span>
  );
}

/**
 * An atomic inline token for `@…` mentions and bare catalog entity refs.
 * Carries the resolved entity ref plus the literal text it came from;
 * markdown export reproduces that literal text (see the MENTION
 * transformer), so the stored markdown is exactly what the user typed.
 */
export class MentionNode extends DecoratorNode<JSX.Element> {
  __entityRef: string;
  __label: string;

  static getType(): string {
    return 'mention';
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__entityRef, node.__label, node.__key);
  }

  static importJSON(serialized: SerializedMentionNode): MentionNode {
    return $createMentionNode(serialized.entityRef, serialized.label);
  }

  constructor(entityRef: string, label: string, key?: NodeKey) {
    super(key);
    this.__entityRef = entityRef;
    this.__label = label;
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      type: 'mention',
      entityRef: this.__entityRef,
      label: this.__label,
    };
  }

  createDOM(): HTMLElement {
    return document.createElement('span');
  }

  updateDOM(): boolean {
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.textContent = this.__label;
    return { element };
  }

  getEntityRef(): string {
    return this.__entityRef;
  }

  getLabel(): string {
    return this.__label;
  }

  getTextContent(): string {
    return this.__label;
  }

  isInline(): boolean {
    return true;
  }

  decorate(): JSX.Element {
    return (
      <MentionComponent entityRef={this.__entityRef} label={this.__label} />
    );
  }
}

export function $createMentionNode(
  entityRef: string,
  label: string,
): MentionNode {
  return $applyNodeReplacement(new MentionNode(entityRef, label));
}

export function $isMentionNode(
  node: LexicalNode | null | undefined,
): node is MentionNode {
  return node instanceof MentionNode;
}
