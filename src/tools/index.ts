/**
 * MCP Tools Registration
 * Exports all tool definitions and handlers
 */
import { GET_COMPANY_TOOL, executeGetCompany } from './get-company.js';
import { GET_DOCUMENTS_TOOL, executeGetDocuments } from './get-documents.js';
import { GET_ANNUAL_REPORT_TOOL, executeGetAnnualReport } from './get-annual-report.js';
import { GET_BOARD_MEMBERS_TOOL, executeGetBoardMembers } from './get-board-members.js';

/**
 * All available tools
 */
export const TOOLS = [
  GET_COMPANY_TOOL,
  GET_DOCUMENTS_TOOL,
  GET_ANNUAL_REPORT_TOOL,
  GET_BOARD_MEMBERS_TOOL,
] as const;

/**
 * Tool name type
 */
export type ToolName = typeof TOOLS[number]['name'];

/**
 * Tool executor map
 */
export const TOOL_EXECUTORS: Record<
  ToolName,
  (args: unknown, requestId?: string) => Promise<{
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
  }>
> = {
  get_company: executeGetCompany,
  get_documents: executeGetDocuments,
  get_annual_report: executeGetAnnualReport,
  get_board_members: executeGetBoardMembers,
};

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  args: unknown,
  requestId?: string
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const executor = TOOL_EXECUTORS[name as ToolName];

  if (!executor) {
    return {
      content: [{ type: 'text', text: `Okänt verktyg: ${name}` }],
      isError: true,
    };
  }

  return executor(args, requestId);
}

// Re-export individual tools for direct access
export { GET_COMPANY_TOOL, executeGetCompany } from './get-company.js';
export { GET_DOCUMENTS_TOOL, executeGetDocuments } from './get-documents.js';
export { GET_ANNUAL_REPORT_TOOL, executeGetAnnualReport } from './get-annual-report.js';
export { GET_BOARD_MEMBERS_TOOL, executeGetBoardMembers } from './get-board-members.js';
