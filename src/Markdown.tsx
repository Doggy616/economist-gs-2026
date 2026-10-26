import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { displayText } from "./data";
export default function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {displayText(text)}
      </ReactMarkdown>
    </div>
  );
}
