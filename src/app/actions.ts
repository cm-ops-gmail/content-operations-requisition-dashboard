
"use server";

import { intelligentTicketRouting, type IntelligentTicketRoutingInput } from '@/ai/flows/intelligent-ticket-routing';
import { appendRow, getSheetData, addColumn, updateColumn, deleteColumn, batchUpdateSheet, getSheetId } from '@/lib/google-sheets';
import type { FormQuestion, KanbanTask } from '@/lib/mock-data';

export async function getTicketRoutingSuggestion(formData: FormData) {
  try {
    const description = formData.get('details') as string;
    const name = formData.get('name') as string;

    if (!description || !name) {
      return { success: false, error: 'Name and details are required.' };
    }

    const input: IntelligentTicketRoutingInput = {
      description: description,
      productCourseRequisitionName: name,
      adminSettingsLabels: 'Urgent, Bug, Feature Request, High Priority, Billing, Technical Issue, How-to',
      knowledgeBaseArticles: `
        1. "Password Reset Guide": How to reset your account password.
        2. "Billing and Subscriptions": Managing your subscription and payment methods.
        3. "Getting Started with SheetFlow": A guide for new users.
        4. "API Integration Manual": Technical documentation for developers.
      `,
      teamNames: 'Engineering, Support, Sales, Marketing'
    };

    const result = await intelligentTicketRouting(input);
    return { success: true, data: result };
  } catch (error) {
    console.error('AI routing error:', error);
    if (error instanceof Error) {
        return { success: false, error: `An error occurred: ${error.message}` };
    }
    return { success: false, error: 'An unknown error occurred while getting AI suggestion.' };
  }
}

export async function submitTicket(data: Record<string, any>) {
  const now = new Date();
    // UTC offset for Bangladesh is +6 hours
    const bstOffset = 6 * 60 * 60 * 1000;
    const bstDate = new Date(now.getTime() + bstOffset);
    
    // Manually format the date to 'YYYY-MM-DD HH:MM:SS'
    const year = bstDate.getUTCFullYear();
    const month = (bstDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = bstDate.getUTCDate().toString().padStart(2, '0');
    const hours = bstDate.getUTCHours().toString().padStart(2, '0');
    const minutes = bstDate.getUTCMinutes().toString().padStart(2, '0');
    const seconds = bstDate.getUTCSeconds().toString().padStart(2, '0');
    const formattedBstDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    const dataWithTimestamp = {
        ...data,
        'Ticket ID': `TICKET-${Date.now()}`,
        'Created Date': formattedBstDate,
        'Status': 'Open'
    };
    return await appendRow(dataWithTimestamp, 'Tickets');
}

// Inferred question type based on header text
function inferQuestionType(header: string): { type: FormQuestion['questionType'], options: string[] } {
    const lowerHeader = header.toLowerCase();
    
    if (lowerHeader.includes('(select:')) {
      const optionsMatch = header.match(/\(select:\s*(.*?)\)/i);
      const options = optionsMatch ? optionsMatch[1].split(';').map(o => o.trim()) : [];
      return { type: 'Select', options };
    }
    if (lowerHeader.includes('(checkbox:')) {
      const optionsMatch = header.match(/\(checkbox:\s*(.*?)\)/i);
      const options = optionsMatch ? optionsMatch[1].split(';').map(o => o.trim()) : [];
      return { type: 'Checkbox', options };
    }
    if (lowerHeader.includes('(textarea)') || lowerHeader.includes('describe') || lowerHeader.includes('detail')) return { type: 'Textarea', options: [] };
    if (lowerHeader.includes('(url)') || lowerHeader.includes('link')) return { type: 'Url', options: [] };
    if (lowerHeader.includes('date')) return { type: 'Date', options: [] };

    return { type: 'Text', options: [] };
}


export async function getFormQuestions(team: string): Promise<FormQuestion[]> {
    if (!team) return [];

    const sheetData = await getSheetData('FormQuestions');
    if (!sheetData.values || sheetData.values.length === 0) {
        // Initialize FormQuestions with headers if it's empty
        await appendRow({ 'Team': 'Team', 'QuestionText': 'QuestionText'}, 'FormQuestions', true);
        return [];
    }
    const headers = sheetData.values[0];
    const teamIndex = headers.indexOf('Team');
    const questionTextIndex = headers.indexOf('QuestionText');

    if (teamIndex === -1 || questionTextIndex === -1) {
        // This case indicates FormQuestions is not set up correctly.
        // Let's try to set it up.
        await appendRow({ 'Team': 'Team', 'QuestionText': 'QuestionText'}, 'FormQuestions', true);
        return [];
    }

    const teamQuestions = sheetData.values
        .slice(1)
        .map((row, index) => ({ row, originalIndex: index + 1 })) // Keep track of original index
        .filter(({ row }) => row[teamIndex] === team)
        .map(({ row, originalIndex }) => {
            const questionText = row[questionTextIndex];
            const { type, options } = inferQuestionType(questionText);
            return {
                id: `col-${originalIndex}`,
                questionText: questionText,
                questionType: type,
                options: options,
            };
        });

    return teamQuestions;
}

export async function getTeams(): Promise<string[]> {
    const sheetData = await getSheetData('FormQuestions');
    if (!sheetData.values || sheetData.values.length <= 1) {
        return [];
    }
    const headers = sheetData.values[0];
    const teamIndex = headers.indexOf('Team');
    if (teamIndex === -1) {
        return [];
    }
    const teams = new Set(sheetData.values.slice(1).map(row => row[teamIndex]));
    return Array.from(teams);
}

export async function addTeam(teamName: string) {
    // A new team is implicitly created by adding a question for it.
    // We can add a dummy entry to make it appear in the list, 
    // which will be overwritten when a real question is added.
    // Let's add a placeholder to ensure it appears in the list.
    return addFormQuestion(teamName, "Default placeholder question (can be deleted)");
}


export async function addFormQuestion(team: string, questionText: string) {
    if (!questionText || !team) {
        return { success: false, error: 'Team and question text cannot be empty.' };
    }
    return await appendRow({ Team: team, QuestionText: questionText }, 'FormQuestions');
}

async function findQuestionRowIndex(team: string, questionText: string): Promise<number> {
    const sheetData = await getSheetData('FormQuestions');
    if (!sheetData.values || sheetData.values.length === 0) throw new Error('FormQuestions is empty or not found.');

    const headers = sheetData.values[0];
    const teamIndex = headers.indexOf('Team');
    const questionTextIndex = headers.indexOf('QuestionText');

    if (teamIndex === -1 || questionTextIndex === -1) throw new Error('Required columns (Team, QuestionText) not found in FormQuestions.');

    const rowIndex = sheetData.values.findIndex(row => row[teamIndex] === team && row[questionTextIndex] === questionText);

    if (rowIndex === -1) throw new Error(`Question "${questionText}" for team "${team}" not found.`);
    return rowIndex;
}


export async function updateFormQuestion(team: string, originalQuestionText: string, newQuestionText: string) {
     if (!newQuestionText) {
        return { success: false, error: 'New question text cannot be empty.' };
    }
    try {
        const rowIndex = await findQuestionRowIndex(team, originalQuestionText);
        
        const sheetId = await getSheetId('FormQuestions');
        const sheetData = await getSheetData('FormQuestions');
        const headers = sheetData.values[0];
        const questionTextColIndex = headers.indexOf('QuestionText');
        
        const updateRequest = {
            updateCells: {
                range: {
                    sheetId: sheetId,
                    startRowIndex: rowIndex,
                    endRowIndex: rowIndex + 1,
                    startColumnIndex: questionTextColIndex,
                    endColumnIndex: questionTextColIndex + 1,
                },
                rows: [ { values: [{ userEnteredValue: { stringValue: newQuestionText } }] } ],
                fields: 'userEnteredValue'
            }
        };

        return await batchUpdateSheet([updateRequest]);
    } catch (error) {
        console.error('Error updating form question:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

export async function deleteFormQuestion(team: string, questionText: string) {
    try {
        const rowIndex = await findQuestionRowIndex(team, questionText);
        const sheetId = await getSheetId('FormQuestions');
        
        const deleteRequest = {
            deleteDimension: {
                range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: rowIndex,
                    endIndex: rowIndex + 1
                }
            }
        };

        return await batchUpdateSheet([deleteRequest]);
    } catch (error) {
        console.error('Error deleting form question:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

export async function getAllTickets() {
    return await getSheetData('Tickets');
}

export async function updateTicketStatus(rowIndex: number, newStatus: string) {
     try {
        const ticketSheetData = await getSheetData('Tickets');
        if (!ticketSheetData.values || ticketSheetData.values.length === 0) {
            return { success: false, error: 'No ticket data found to update.' };
        }
        const headers = ticketSheetData.values[0];
        const statusColIndex = headers.indexOf('Status');
         if (statusColIndex === -1) {
             return { success: false, error: 'Status column not found in Tickets.' };
         }
         
        const ticketSheetId = await getSheetId('Tickets');

        const updateRequest = {
            updateCells: {
                range: {
                    sheetId: ticketSheetId,
                    startRowIndex: rowIndex, // This is now the correct sheet row index
                    endRowIndex: rowIndex + 1,
                    startColumnIndex: statusColIndex,
                    endColumnIndex: statusColIndex + 1,
                },
                rows: [ { values: [{ userEnteredValue: { stringValue: newStatus } }] } ],
                fields: 'userEnteredValue'
            }
        };
        
        return await batchUpdateSheet([updateRequest]);
    } catch (error) {
        console.error('Error updating ticket status:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}


export async function getMembers() {
    return await getSheetData('Members');
}

export async function addMember(name: string, team: string) {
    if (!name || !team) {
        return { success: false, error: 'Name and team are required.' };
    }

    try {
        const sheetData = await getSheetData('Members');
        const headers = sheetData.values?.[0] || ['Name', 'Team'];
        if (!sheetData.values || sheetData.values.length === 0) {
             await appendRow(Object.fromEntries(headers.map(h => [h, h])), 'Members', true);
        }

        const teamIndex = headers.indexOf('Team');
        const existingTeams = new Set((sheetData.values || []).slice(1).map(row => row[teamIndex]));
        
        const predefinedTeams = ["CM", "SMD", "QAC", "Class Ops"];
        const teamsToAdd = predefinedTeams.filter(t => !existingTeams.has(t));

        for (const t of teamsToAdd) {
            await appendRow({ Name: 'Team Default', Team: t }, 'Members');
        }

        if (name === 'Team Default' && predefinedTeams.includes(team)) {
            // This was just a seeding call, no need to add another.
            return { success: true };
        }

        return await appendRow({ Name: name, Team: team }, 'Members');

    } catch (error) {
         console.error('Error adding member:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}


export async function getProjects() {
    return await getSheetData('Projects');
}

export async function createProjectFromTicket(ticketRow: { rowIndex: number, values: string[] }) {
    try {
        const ticketSheetData = await getSheetData('Tickets');
        const ticketHeaders = ticketSheetData.values[0];

        const ticketIdIndex = ticketHeaders.findIndex(h => h === 'Ticket ID');
        if (ticketIdIndex === -1) {
            return { success: false, error: 'Ticket ID column not found in the source sheet.' };
        }
        const ticketId = ticketRow.values[ticketIdIndex];

        const projectId = `PROJ-${Date.now()}`;

        const projectHeaders = ['Project ID', 'Ticket ID', 'Start Date', 'End Date', 'Assignee', 'Kanban Initialized', ...ticketHeaders.filter(h => h !== 'Ticket ID')];

        // Ensure Projects has headers
        const projectSheetData = await getSheetData('Projects');
        if (!projectSheetData.values || projectSheetData.values.length === 0) {
            await appendRow(projectHeaders.reduce((acc, h) => ({...acc, [h]: ''}), {}), 'Projects', true);
        }

        const projectData: Record<string, string> = {
            'Project ID': projectId,
            'Ticket ID': ticketId,
            'Start Date': '',
            'End Date': '',
            'Assignee': '',
            'Kanban Initialized': 'No'
        };
        
        ticketHeaders.forEach((header, i) => {
            if (header !== 'Ticket ID') {
                projectData[header] = ticketRow.values[i] || '';
            }
        });
        
        await appendRow(projectData, 'Projects');

        // Instead of deleting, update the status of the ticket
        await updateTicketStatus(ticketRow.rowIndex, 'In Progress');

        return { success: true };

    } catch(error) {
        console.error('Error creating project:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

export async function updateProject(rowIndex: number, newValues: { [key: string]: string }) {
    try {
        const projectSheetData = await getSheetData('Projects');
        if (!projectSheetData.values || projectSheetData.values.length === 0) {
            return { success: false, error: 'No projects found to update.' };
        }
        const headers = projectSheetData.values[0];
        const originalRow = projectSheetData.values[rowIndex];
        if (!originalRow) {
            return { success: false, error: 'Project row not found.' };
        }

        const updatedRow = [...originalRow];
        
        Object.entries(newValues).forEach(([header, value]) => {
            const colIndex = headers.indexOf(header);
            if (colIndex !== -1) {
                updatedRow[colIndex] = value;
            }
        });
        
        const projectSheetId = await getSheetId('Projects');

        const updateRequest = {
            updateCells: {
                range: {
                    sheetId: projectSheetId,
                    startRowIndex: rowIndex,
                    endRowIndex: rowIndex + 1,
                    startColumnIndex: 0,
                    endColumnIndex: headers.length,
                },
                rows: [
                    {
                        values: updatedRow.map(val => ({ userEnteredValue: { stringValue: val } }))
                    }
                ],
                fields: 'userEnteredValue'
            }
        };
        
        return await batchUpdateSheet([updateRequest]);
    } catch (error) {
        console.error('Error updating project:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}


export async function initializeKanban(rowIndex: number, projectId: string) {
    try {
        const kanbanSheetData = await getSheetData('KanbanTasks');
        if (!kanbanSheetData.values || kanbanSheetData.values.length === 0) {
            const headers = ['Project ID', 'Task ID', 'Title', 'Status', 'Assignee', 'Due Date', 'Description', 'Type', 'Priority', 'Tags'];
            await appendRow(headers.reduce((acc, h) => ({...acc, [h]: ''}), {}), 'KanbanTasks', true);
        }
        
        await appendRow({
            'Project ID': projectId,
            'Task ID': `TASK-${Date.now()}`,
            'Title': 'Project Kick-off',
            'Status': 'todo',
            'Assignee': '',
            'Due Date': '',
            'Description': 'Initial setup and planning for the project.',
            'Type': 'Planning',
            'Priority': 'High',
            'Tags': 'kickoff,planning'
        }, 'KanbanTasks');

        return await updateProject(rowIndex + 1, { 'Kanban Initialized': 'Yes' });

    } catch (error) {
        console.error('Error initializing Kanban:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

export async function getKanbanTasks(projectId: string): Promise<KanbanTask[]> {
    try {
        const kanbanData = await getSheetData('KanbanTasks');
        if (!kanbanData.values || kanbanData.values.length < 1) {
            return [];
        }
        const headers = kanbanData.values[0];
        const projectIdIndex = headers.indexOf('Project ID');
        const taskIdIndex = headers.indexOf('Task ID');
        const titleIndex = headers.indexOf('Title');
        const statusIndex = headers.indexOf('Status');
        const assigneeIndex = headers.indexOf('Assignee');
        const dueDateIndex = headers.indexOf('Due Date');
        const descriptionIndex = headers.indexOf('Description');
        const typeIndex = headers.indexOf('Type');
        const priorityIndex = headers.indexOf('Priority');
        const tagsIndex = headers.indexOf('Tags');

        if (projectIdIndex === -1 || taskIdIndex === -1 || statusIndex === -1) {
            throw new Error("Required columns (Project ID, Task ID, Status) not found in KanbanTasks.");
        }

        return kanbanData.values
            .slice(1)
            .map((row, index) => ({
                sheetRowIndex: index + 2, // 1-based index + header
                id: row[taskIdIndex],
                projectId: row[projectIdIndex],
                title: row[titleIndex],
                status: row[statusIndex] as 'todo' | 'inprogress' | 'review' | 'done',
                assignee: row[assigneeIndex],
                dueDate: row[dueDateIndex],
                description: row[descriptionIndex] || '',
                type: row[typeIndex] || 'Task',
                priority: row[priorityIndex] as 'Low' | 'Medium' | 'High' | 'Critical' || 'Medium',
                tags: row[tagsIndex] ? row[tagsIndex].split(',') : []
            }))
            .filter(task => task.projectId === projectId);

    } catch (error) {
        console.error('Error fetching Kanban tasks:', error);
        return [];
    }
}

export async function addKanbanTask(
    projectId: string, 
    taskData: Omit<KanbanTask, 'id' | 'sheetRowIndex' | 'projectId' | 'status'>
) {
    const dataToSave = {
        'Project ID': projectId,
        'Task ID': `TASK-${Date.now()}`,
        'Title': taskData.title,
        'Status': 'todo',
        'Description': taskData.description,
        'Type': taskData.type,
        'Priority': taskData.priority,
        'Assignee': taskData.assignee,
        'Due Date': taskData.dueDate,
        'Tags': taskData.tags.join(','),
    };
    return await appendRow(dataToSave, 'KanbanTasks');
}

export async function updateKanbanTaskStatus(sheetRowIndex: number, newStatus: string) {
     try {
        const kanbanSheetData = await getSheetData('KanbanTasks');
        if (!kanbanSheetData.values || kanbanSheetData.values.length === 0) {
            return { success: false, error: 'No kanban data found to update.' };
        }
        const headers = kanbanSheetData.values[0];
        const statusColIndex = headers.indexOf('Status');
         if (statusColIndex === -1) {
             return { success: false, error: 'Status column not found in KanbanTasks.' };
         }
         
        const kanbanSheetId = await getSheetId('KanbanTasks');

        const updateRequest = {
            updateCells: {
                range: {
                    sheetId: kanbanSheetId,
                    startRowIndex: sheetRowIndex - 1,
                    endRowIndex: sheetRowIndex,
                    startColumnIndex: statusColIndex,
                    endColumnIndex: statusColIndex + 1,
                },
                rows: [ { values: [{ userEnteredValue: { stringValue: newStatus } }] } ],
                fields: 'userEnteredValue'
            }
        };
        
        return await batchUpdateSheet([updateRequest]);
    } catch (error) {
        console.error('Error updating task status:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

export async function deleteKanbanTask(sheetRowIndex: number) {
    try {
        const kanbanSheetId = await getSheetId('KanbanTasks');
        const deleteRequest = {
            deleteDimension: {
                range: {
                    sheetId: kanbanSheetId,
                    dimension: "ROWS",
                    startIndex: sheetRowIndex - 1, // Convert 1-based to 0-based
                    endIndex: sheetRowIndex
                }
            }
        };
        return await batchUpdateSheet([deleteRequest]);
    } catch (error) {
        console.error('Error deleting task:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

export async function getWorkTypes(): Promise<{ question: string; options: string[] }> {
    const sheetName = 'WorkTypes';
    const defaultQuestion = 'What type of work is this?';
    const defaultOptions = ['Urgent', 'Regular'];

    try {
        let sheetData = await getSheetData(sheetName);

        if (!sheetData.values || sheetData.values.length === 0) {
            const header = { [defaultQuestion]: defaultQuestion };
            await appendRow(header, sheetName, true);
            
            for (const type of defaultOptions) {
                await appendRow({ [defaultQuestion]: type }, sheetName);
            }
            
            sheetData = await getSheetData(sheetName);
        }

        if (!sheetData.values || sheetData.values.length < 1) {
             throw new Error("Work types sheet is not configured correctly.");
        }

        const question = sheetData.values[0][0] || defaultQuestion;
        const options = sheetData.values.slice(1).map(row => row[0]).filter(Boolean);
        
        return { question, options };

    } catch (error) {
        console.error("Error in getWorkTypes:", error);
        return { question: defaultQuestion, options: defaultOptions };
    }
}
    
export async function addWorkTypeOption(option: string) {
    const sheetName = 'WorkTypes';
    try {
        const sheetData = await getSheetData(sheetName);
        if (!sheetData.values || sheetData.values.length === 0) {
            return { success: false, error: 'Work types sheet not found or is empty.' };
        }
        const header = sheetData.values[0][0];
        return await appendRow({ [header]: option }, sheetName);
    } catch (error) {
        console.error('Error adding work type option:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

async function findWorkTypeRowIndex(option: string): Promise<number> {
    const sheetData = await getSheetData('WorkTypes');
    if (!sheetData.values || sheetData.values.length === 0) throw new Error('WorkTypes is empty.');
    // Start search from row 1 (after header)
    const rowIndex = sheetData.values.slice(1).findIndex(row => row[0] === option);
    if (rowIndex === -1) throw new Error(`Option "${option}" not found.`);
    return rowIndex + 1; // Return the actual sheet row index (1-based)
}

export async function updateWorkTypeOption(originalOption: string, newOption: string) {
    try {
        const rowIndex = await findWorkTypeRowIndex(originalOption);
        const sheetId = await getSheetId('WorkTypes');

        const updateRequest = {
            updateCells: {
                range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 1 },
                rows: [{ values: [{ userEnteredValue: { stringValue: newOption } }] }],
                fields: 'userEnteredValue.stringValue'
            }
        };

        return await batchUpdateSheet([updateRequest]);
    } catch (error) {
        console.error('Error updating work type option:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

export async function deleteWorkTypeOption(option: string) {
    try {
        const rowIndex = await findWorkTypeRowIndex(option);
        const sheetId = await getSheetId('WorkTypes');

        const deleteRequest = {
            deleteDimension: {
                range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 }
            }
        };

        return await batchUpdateSheet([deleteRequest]);
    } catch (error) {
        console.error('Error deleting work type option:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

export async function updateWorkTypeQuestion(newQuestion: string) {
    try {
        const sheetId = await getSheetId('WorkTypes');
        const updateRequest = {
            updateCells: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
                rows: [{ values: [{ userEnteredValue: { stringValue: newQuestion } }] }],
                fields: 'userEnteredValue.stringValue'
            }
        };
        return await batchUpdateSheet([updateRequest]);
    } catch (error) {
        console.error('Error updating work type question:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}
