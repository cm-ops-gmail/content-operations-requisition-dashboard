

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
    const hours = (bstDate.getUTCHours()).toString().padStart(2, '0');
    const minutes = (bstDate.getUTCMinutes()).toString().padStart(2, '0');
    const seconds = (bstDate.getUTCSeconds()).toString().padStart(2, '0');
    const formattedBstDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    const dataWithTimestamp = {
        ...data,
        'Ticket ID': `TICKET-${Date.now()}`,
        'Created Date': formattedBstDate,
        'Status': 'In Review',
        'Assignee': ''
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
    if (lowerHeader.includes('(textarea)')) return { type: 'Textarea', options: [] };
    if (lowerHeader.includes('(url)')) return { type: 'Url', options: [] };
    if (lowerHeader.includes('date')) return { type: 'Date', options: [] };
    
    if (lowerHeader.includes('describe') || lowerHeader.includes('detail')) return { type: 'Textarea', options: [] };
    if (lowerHeader.includes('link')) return { type: 'Url', options: [] };

    return { type: 'Text', options: [] };
}


export async function getFormQuestions(team: string): Promise<FormQuestion[]> {
    if (!team) return [];

    try {
        const sheetData = await getSheetData('FormQuestions');
        if (!sheetData.values || sheetData.values.length === 0) {
            // Initialize FormQuestions with headers if it's empty
            await appendRow({ 'Team': 'Team', 'QuestionText': 'QuestionText'}, 'FormQuestions');
            return [];
        }
        const headers = sheetData.values[0];
        const teamIndex = headers.indexOf('Team');
        const questionTextIndex = headers.indexOf('QuestionText');

        if (teamIndex === -1 || questionTextIndex === -1) {
            // This case indicates FormQuestions is not set up correctly.
            // Let's try to set it up.
            await appendRow({ 'Team': 'Team', 'QuestionText': 'QuestionText'}, 'FormQuestions');
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
    } catch (error) {
        console.error(`Error in getFormQuestions for team ${team}:`, error);
        // Attempt to initialize the sheet if it might not exist
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('Permission denied'))) {
            try {
                await getSheetId('FormQuestions'); // This will create it if it doesn't exist.
                await appendRow({ 'Team': 'Team', 'QuestionText': 'QuestionText'}, 'FormQuestions');
            } catch (initError) {
                console.error('Failed to initialize FormQuestions sheet:', initError);
            }
        }
        return []; // Return empty array on error
    }
}

export async function getTeams(): Promise<string[]> {
    try {
        const sheetData = await getSheetData('FormQuestions');
        const teams = new Set((sheetData.values || []).slice(1).map(row => row[0]).filter(Boolean));
        return Array.from(teams);
    } catch (error) {
        console.error('Error getting teams:', error);
        return [];
    }
}

export async function addTeam(teamName: string) {
    // A new team is implicitly created by adding a question for it.
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

export async function updateTicket(rowIndex: number, newValues: { [key: string]: string }) {
    try {
        const ticketSheetData = await getSheetData('Tickets');
        if (!ticketSheetData.values || ticketSheetData.values.length === 0) {
            return { success: false, error: 'No tickets found to update.' };
        }
        const headers = ticketSheetData.values[0];
        
        const updateRequests: any[] = [];
        const ticketSheetId = await getSheetId('Tickets');

        for (const [header, value] of Object.entries(newValues)) {
            let colIndex = headers.indexOf(header);
            
            if (colIndex === -1) {
                // If header doesn't exist, add it as a new column
                await addColumn(header, 'Tickets');
                const refreshedData = await getSheetData('Tickets');
                const refreshedHeaders = refreshedData.values?.[0] || [];
                colIndex = refreshedHeaders.indexOf(header);
                if (colIndex === -1) {
                    console.warn(`Could not find or create column ${header}`);
                    continue;
                }
            }

            if (colIndex !== -1) {
                 updateRequests.push({
                    updateCells: {
                        range: {
                            sheetId: ticketSheetId,
                            startRowIndex: rowIndex, 
                            endRowIndex: rowIndex + 1,
                            startColumnIndex: colIndex,
                            endColumnIndex: colIndex + 1,
                        },
                        rows: [{ values: [{ userEnteredValue: { stringValue: value } }] }],
                        fields: 'userEnteredValue'
                    }
                });
            }
        }
        
        if (updateRequests.length === 0) {
            return { success: true }; // No updates were needed
        }
        
        return await batchUpdateSheet(updateRequests);
    } catch (error) {
        console.error('Error updating ticket:', error);
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
             await appendRow(Object.fromEntries(headers.map(h => [h, h])), 'Members');
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

export async function createProjectFromTicket(ticketRow: { rowIndex: number, values: string[] }, projectTitle: string) {
    try {
        const ticketSheetData = await getSheetData('Tickets');
        const ticketHeaders = ticketSheetData.values[0];

        const ticketIdIndex = ticketHeaders.findIndex(h => h === 'Ticket ID');
        if (ticketIdIndex === -1) {
            return { success: false, error: 'Ticket ID column not found in the source sheet.' };
        }
        const ticketId = ticketRow.values[ticketIdIndex];

        const projectId = `PROJ-${Date.now()}`;

        let projectHeaders = (await getSheetData('Projects')).values?.[0];
        if (!projectHeaders || projectHeaders.length === 0) {
            projectHeaders = ['Project ID', 'Project Title', 'Ticket ID', 'Status', 'Start Date', 'End Date', 'Assignee', 'Kanban Initialized'];
            await appendRow(Object.fromEntries(projectHeaders.map(h => [h, ''])), 'Projects');
        } else {
             if (!projectHeaders.includes('Project Title')) {
                await addColumn('Project Title', 'Projects');
                projectHeaders.push('Project Title');
            }
            if (!projectHeaders.includes('Status')) {
                await addColumn('Status', 'Projects');
                projectHeaders.push('Status');
            }
        }
        
        const projectData: Record<string, string> = {
            'Project ID': projectId,
            'Project Title': projectTitle,
            'Ticket ID': ticketId,
            'Status': 'In Review',
            'Start Date': '',
            'End Date': '',
            'Assignee': '',
            'Kanban Initialized': 'No'
        };
        
        ticketHeaders.forEach((header, i) => {
            if (header !== 'Ticket ID' && projectHeaders?.includes(header)) {
                projectData[header] = ticketRow.values[i] || '';
            }
        });
        
        await appendRow(projectData, 'Projects');

        // Update the status of the ticket to 'Completed' using the correct row index
        await updateTicket(ticketRow.rowIndex, { 'Status': 'Completed' });

        return { success: true };

    } catch(error) {
        console.error('Error creating project:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

export async function createManualProject(projectTitle: string) {
    if (!projectTitle) {
        return { success: false, error: 'Project title is required.' };
    }
    try {
        const projectId = `PROJ-${Date.now()}`;

        let projectHeaders = (await getSheetData('Projects')).values?.[0];
        if (!projectHeaders || projectHeaders.length === 0) {
            projectHeaders = ['Project ID', 'Project Title', 'Ticket ID', 'Status', 'Start Date', 'End Date', 'Assignee', 'Kanban Initialized'];
             // Create header row if it doesn't exist
            await appendRow(Object.fromEntries(projectHeaders.map(h => [h, h])), 'Projects');
        } else {
            if (!projectHeaders.includes('Project Title')) {
                await addColumn('Project Title', 'Projects');
                projectHeaders.push('Project Title');
            }
            if (!projectHeaders.includes('Status')) {
                await addColumn('Status', 'Projects');
                projectHeaders.push('Status');
            }
        }

        const projectData: Record<string, string> = {
            'Project ID': projectId,
            'Project Title': projectTitle,
            'Ticket ID': '',
            'Status': 'In Review',
            'Start Date': '',
            'End Date': '',
            'Assignee': '',
            'Kanban Initialized': 'No'
        };

        return await appendRow(projectData, 'Projects');
    } catch (error) {
        console.error('Error creating manual project:', error);
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
        
        const projectSheetId = await getSheetId('Projects');

        const updateRequests = Object.entries(newValues).map(([header, value]) => {
            const colIndex = headers.indexOf(header);
            if (colIndex === -1) return null; // Should not happen if columns are managed properly
            return {
                updateCells: {
                    range: {
                        sheetId: projectSheetId,
                        startRowIndex: rowIndex,
                        endRowIndex: rowIndex + 1,
                        startColumnIndex: colIndex,
                        endColumnIndex: colIndex + 1,
                    },
                    rows: [{ values: [{ userEnteredValue: { stringValue: value } }] }],
                    fields: 'userEnteredValue'
                }
            };
        }).filter(Boolean);
        
        if (updateRequests.length === 0) {
            return { success: true };
        }

        return await batchUpdateSheet(updateRequests as any[]);
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
            const headers = ['Project ID', 'Sequence', 'Task ID', 'Title', 'Status', 'Assignee', 'Due Date', 'Description', 'Type', 'Priority', 'Tags'];
            await appendRow(headers.reduce((acc, h) => ({...acc, [h]: h}), {}), 'KanbanTasks');
        }
        
        await appendRow({
            'Project ID': projectId,
            'Sequence': '1',
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

        return await updateProject(rowIndex, { 'Kanban Initialized': 'Yes' });

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
        const sequenceIndex = headers.indexOf('Sequence');
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
            .map((row, index) => {
                const sequenceNumber = sequenceIndex !== -1 ? parseInt(row[sequenceIndex], 10) : index + 1;
                return {
                    sheetRowIndex: index + 2, // 1-based index + header
                    id: row[taskIdIndex],
                    projectId: row[projectIdIndex],
                    sequenceNumber: isNaN(sequenceNumber) ? index + 1 : sequenceNumber,
                    title: row[titleIndex],
                    status: row[statusIndex] as 'todo' | 'inprogress' | 'review' | 'done',
                    assignee: row[assigneeIndex],
                    dueDate: row[dueDateIndex],
                    description: row[descriptionIndex] || '',
                    type: row[typeIndex] || 'Task',
                    priority: row[priorityIndex] as 'Low' | 'Medium' | 'High' | 'Critical' || 'Medium',
                    tags: row[tagsIndex] ? row[tagsIndex].split(',') : []
                };
            })
            .filter(task => task.projectId === projectId);

    } catch (error) {
        console.error('Error fetching Kanban tasks:', error);
        return [];
    }
}

export async function addKanbanTask(
    projectId: string, 
    taskData: Omit<KanbanTask, 'id' | 'sheetRowIndex' | 'projectId' | 'status' | 'sequenceNumber'>
) {
    const existingTasks = await getKanbanTasks(projectId);
    const nextSequenceNumber = (existingTasks.length > 0 ? Math.max(...existingTasks.map(t => t.sequenceNumber)) : 0) + 1;

    const dataToSave = {
        'Project ID': projectId,
        'Sequence': nextSequenceNumber.toString(),
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

export async function updateKanbanTask(
    sheetRowIndex: number,
    taskData: Partial<Omit<KanbanTask, 'id' | 'sheetRowIndex' | 'projectId'>>
) {
    try {
        const kanbanSheetData = await getSheetData('KanbanTasks');
        if (!kanbanSheetData.values || kanbanSheetData.values.length === 0) {
            return { success: false, error: 'No kanban data found to update.' };
        }
        const headers = kanbanSheetData.values[0];
        
        const dataToSave: Record<string, string | undefined> = {
            'Title': taskData.title,
            'Description': taskData.description,
            'Type': taskData.type,
            'Priority': taskData.priority,
            'Assignee': taskData.assignee,
            'Due Date': taskData.dueDate,
            'Tags': taskData.tags?.join(','),
            'Sequence': taskData.sequenceNumber?.toString(),
            'Status': taskData.status,
        };

        const updateRequests = Object.entries(dataToSave).map(([header, value]) => {
            if (value === undefined) return null;
            const colIndex = headers.indexOf(header);
            if (colIndex === -1) return null;
            return {
                updateCells: {
                    range: {
                        sheetId: 0, 
                        startRowIndex: sheetRowIndex - 1,
                        endRowIndex: sheetRowIndex,
                        startColumnIndex: colIndex,
                        endColumnIndex: colIndex + 1,
                    },
                    rows: [{ values: [{ userEnteredValue: { stringValue: value } }] }],
                    fields: 'userEnteredValue.stringValue'
                }
            };
        }).filter(Boolean);

        if (updateRequests.length === 0) {
            return { success: true }; 
        }
        
        const kanbanSheetId = await getSheetId('KanbanTasks');
        const finalRequests = updateRequests.map(req => {
            if (req) {
              req.updateCells.range.sheetId = kanbanSheetId;
            }
            return req;
        });

        return await batchUpdateSheet(finalRequests as any[]);

    } catch (error) {
        console.error('Error updating task:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

export async function batchUpdateKanbanTaskSequence(
    updates: { sheetRowIndex: number; sequenceNumber: number }[]
) {
    if (updates.length === 0) {
        return { success: true };
    }
    try {
        const kanbanSheetId = await getSheetId('KanbanTasks');
        const kanbanSheetData = await getSheetData('KanbanTasks');
        if (!kanbanSheetData.values || kanbanSheetData.values.length === 0) {
            return { success: false, error: 'No kanban data found to update.' };
        }
        const headers = kanbanSheetData.values[0];
        const sequenceColIndex = headers.indexOf('Sequence');

        if (sequenceColIndex === -1) {
            return { success: false, error: 'Sequence column not found.' };
        }

        const requests = updates.map(({ sheetRowIndex, sequenceNumber }) => ({
            updateCells: {
                range: {
                    sheetId: kanbanSheetId,
                    startRowIndex: sheetRowIndex - 1,
                    endRowIndex: sheetRowIndex,
                    startColumnIndex: sequenceColIndex,
                    endColumnIndex: sequenceColIndex + 1,
                },
                rows: [{
                    values: [{
                        userEnteredValue: { stringValue: sequenceNumber.toString() }
                    }]
                }],
                fields: 'userEnteredValue.stringValue'
            }
        }));

        return await batchUpdateSheet(requests);

    } catch (error) {
        console.error('Error batch updating sequence:', error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
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
            await getSheetId(sheetName); // Ensure sheet exists
            const header = { [defaultQuestion]: defaultQuestion };
            await appendRow(header, sheetName);
            
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

function tryParseDate(dateString: string): string {
    if (!dateString) return '';
    try {
        // Handles 'YYYY-MM-DD HH:MM:SS' and ISO strings
        const isoString = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
        const date = new Date(isoString);
        if (isNaN(date.getTime())) {
            // Attempt to parse other common formats if needed, e.g., 'MM/DD/YYYY'
            const maybeDate = new Date(dateString);
            if(isNaN(maybeDate.getTime())) return '';
            return maybeDate.toISOString();
        }
        return date.toISOString();
    } catch {
        return '';
    }
}

export async function getMyAssignedTasks(assigneeName: string): Promise<Array<{
    id: string;
    title: string;
    status: string;
    source: 'Ticket' | 'Project' | 'Kanban Task';
    sheetRowIndex: number;
    date: string;
}>> {
    if (!assigneeName) return [];

    try {
        const [ticketData, projectData, kanbanData] = await Promise.all([
            getSheetData('Tickets'),
            getSheetData('Projects'),
            getSheetData('KanbanTasks'),
        ]);

        const assignedTasks: any[] = [];
        const lowerCaseAssigneeName = assigneeName.toLowerCase();

        // Process Tickets
        if (ticketData.values && ticketData.values.length > 0) {
            const ticketHeaders = ticketData.values[0];
            const assigneeIndex = ticketHeaders.indexOf('Assignee');
            const ticketIdIndex = ticketHeaders.indexOf('Ticket ID');
            const statusIndex = ticketHeaders.indexOf('Status');
            const titleIndex = ticketHeaders.indexOf('Product/Course/Requisition Name');
            const dateIndex = ticketHeaders.indexOf('Created Date');

            if (assigneeIndex !== -1) {
                ticketData.values.slice(1).forEach((row, index) => {
                    if (row[assigneeIndex]?.toLowerCase() === lowerCaseAssigneeName) {
                        assignedTasks.push({
                            id: row[ticketIdIndex] || `ticket-${index}`,
                            title: `${row[titleIndex] || 'Untitled Ticket'} / ${row[ticketIdIndex]}`,
                            status: row[statusIndex] || 'In Review',
                            source: 'Ticket',
                            sheetRowIndex: index + 2,
                            date: tryParseDate(row[dateIndex]),
                        });
                    }
                });
            }
        }

        // Process Projects
        if (projectData.values && projectData.values.length > 0) {
            const projectHeaders = projectData.values[0];
            const assigneeIndex = projectHeaders.indexOf('Assignee');
            const projectIdIndex = projectHeaders.indexOf('Project ID');
            const statusIndex = projectHeaders.indexOf('Status');
            const titleIndex = projectHeaders.indexOf('Project Title');
            const dateIndex = projectHeaders.indexOf('Start Date');


            if (assigneeIndex !== -1) {
                projectData.values.slice(1).forEach((row, index) => {
                    if (row[assigneeIndex]?.toLowerCase() === lowerCaseAssigneeName) {
                        assignedTasks.push({
                            id: row[projectIdIndex] || `project-${index}`,
                            title: `${row[titleIndex] || 'Untitled Project'} / ${row[projectIdIndex]}`,
                            status: row[statusIndex] || 'In Review',
                            source: 'Project',
                            sheetRowIndex: index + 2,
                            date: tryParseDate(row[dateIndex]),
                        });
                    }
                });
            }
        }
        
        // Process Kanban Tasks
        if (kanbanData.values && kanbanData.values.length > 0) {
            const kanbanHeaders = kanbanData.values[0];
            const assigneeIndex = kanbanHeaders.indexOf('Assignee');
            const taskIdIndex = kanbanHeaders.indexOf('Task ID');
            const statusIndex = kanbanHeaders.indexOf('Status');
            const titleIndex = kanbanHeaders.indexOf('Title');
            const projectIdIndex = kanbanHeaders.indexOf('Project ID');
            const dateIndex = kanbanHeaders.indexOf('Due Date');

            if (assigneeIndex !== -1) {
                kanbanData.values.slice(1).forEach((row, index) => {
                    if (row[assigneeIndex]?.toLowerCase() === lowerCaseAssigneeName) {
                        assignedTasks.push({
                            id: row[taskIdIndex] || `kanban-${index}`,
                            title: `${row[titleIndex] || 'Untitled Task'} / ${row[projectIdIndex]}`,
                            status: row[statusIndex] || 'todo',
                            source: 'Kanban Task',
                            sheetRowIndex: index + 2,
                            date: tryParseDate(row[dateIndex]),
                        });
                    }
                });
            }
        }

        return assignedTasks;
    } catch (error) {
        console.error('Error fetching assigned tasks:', error);
        return [];
    }
}

export async function updateMyTaskStatus(taskInfo: {
    source: 'Ticket' | 'Project' | 'Kanban Task';
    sheetRowIndex: number;
    newStatus: string;
}) {
    const { source, sheetRowIndex, newStatus } = taskInfo;
    let sheetName: string;

    switch (source) {
        case 'Ticket':
            sheetName = 'Tickets';
            break;
        case 'Project':
            sheetName = 'Projects';
            break;
        case 'Kanban Task':
            sheetName = 'KanbanTasks';
            break;
        default:
            return { success: false, error: 'Invalid task source.' };
    }

    try {
        const sheetData = await getSheetData(sheetName);
        if (!sheetData.values || sheetData.values.length === 0) {
            return { success: false, error: `Sheet "${sheetName}" not found or is empty.` };
        }
        const headers = sheetData.values[0];
        const statusColIndex = headers.indexOf('Status');

        if (statusColIndex === -1) {
            await addColumn('Status', sheetName);
             const refreshedData = await getSheetData(sheetName);
             const refreshedHeaders = refreshedData.values?.[0] || [];
             const newStatusColIndex = refreshedHeaders.indexOf('Status');
              if (newStatusColIndex === -1) {
                return { success: false, error: `Failed to create and find Status column in "${sheetName}".` };
             }
             return updateMyTaskStatus(taskInfo); // Retry with the new column
        }

        const sheetId = await getSheetId(sheetName);
        const updateRequest = {
            updateCells: {
                range: {
                    sheetId,
                    startRowIndex: sheetRowIndex - 1, // API is 0-indexed
                    endRowIndex: sheetRowIndex,
                    startColumnIndex: statusColIndex,
                    endColumnIndex: statusColIndex + 1,
                },
                rows: [{ values: [{ userEnteredValue: { stringValue: newStatus } }] }],
                fields: 'userEnteredValue',
            },
        };

        return await batchUpdateSheet([updateRequest]);
    } catch (error) {
        console.error(`Error updating task status in ${source}:`, error);
        if (error instanceof Error) return { success: false, error: error.message };
        return { success: false, error: 'An unknown error occurred.' };
    }
}

    

    
