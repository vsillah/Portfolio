import { parseProposalTerms } from "@/lib/proposal-terms";

function ListText({ text }: { text: string }) {
  const colon = text.indexOf(":");
  return colon > 0 && colon < 100 ? (
    <>
      <strong className="font-semibold text-platinum-white">
        {text.slice(0, colon + 1)}
      </strong>
      {text.slice(colon + 1)}
    </>
  ) : (
    <>{text}</>
  );
}

export function ProposalTerms({ text }: { text: string }) {
  const blocks = parseProposalTerms(text);
  return (
    <div className="space-y-4 text-sm leading-7 text-platinum-white/90 break-words [overflow-wrap:anywhere]">
      {blocks.map((block, index) => {
        if (block.kind === "heading")
          return (
            <h5
              key={index}
              className="pt-3 text-base font-semibold leading-6 text-radiant-gold"
            >
              {block.text}
            </h5>
          );
        if (block.kind === "payment")
          return (
            <table
              key={index}
              className="w-full table-fixed border-y border-radiant-gold/25 text-left"
            >
              <tbody>
                <tr>
                  <th
                    scope="row"
                    className="w-20 align-top py-3 pr-3 font-medium text-radiant-gold"
                  >
                    Payment
                  </th>
                  <td className="py-3 whitespace-pre-wrap">{block.text}</td>
                </tr>
              </tbody>
            </table>
          );
        if (block.kind === "ordered" || block.kind === "bullet") {
          if (index > 0 && blocks[index - 1].kind === block.kind) return null;
          const items = [];
          for (
            let n = index;
            n < blocks.length && blocks[n].kind === block.kind;
            n++
          ) {
            const implicitBullet =
              block.kind === "bullet" && !/^\s*[-*•]\s+/.test(blocks[n].text);
            items.push(
              <li
                key={n}
                className={`whitespace-pre-wrap ${implicitBullet ? "list-disc ml-5" : "list-none"} pl-2`}
              >
                <ListText text={blocks[n].text} />
              </li>,
            );
          }
          return block.kind === "ordered" ? (
            <ol key={index} className="space-y-4">
              {items}
            </ol>
          ) : (
            <ul key={index} className="space-y-2">
              {items}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
