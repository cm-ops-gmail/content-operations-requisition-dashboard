
import { getAllTickets, getWorkTypes, getTeams } from './actions';
import { DashboardClient } from '@/components/DashboardClient';

export const revalidate = 0; // Prevent caching to ensure fresh data
export const dynamic = 'force-dynamic';

async function getDashboardData() {
  try {
    const [ticketData, teamsData, workTypesData] = await Promise.all([
        getAllTickets(), 
        getTeams(),
        getWorkTypes()
    ]);
    
    let tickets: string[][] = [];
    let ticketHeaders: string[] = [];
    let teams: string[] = [];
    let statuses: string[] = [];
    let workTypes: string[] = [];

    if (ticketData.values && ticketData.values.length > 0) {
        ticketHeaders = ticketData.values[0];
        tickets = ticketData.values.slice(1).reverse();
        const statusIndex = ticketHeaders.indexOf('Status');
        
        const uniqueStatuses = new Set<string>();
        
        if (statusIndex !== -1) {
            tickets.forEach(ticket => {
                let status = ticket[statusIndex];
                if (status === 'Open') status = 'Pending';
                if (status) uniqueStatuses.add(status);
            });
        }
        statuses = ['All', ...Array.from(uniqueStatuses)];
    }
    
    if (teamsData && teamsData.length > 0) {
        teams = ['All', ...teamsData];
    }
    
    if (workTypesData && workTypesData.options.length > 0) {
        workTypes = ['All', ...workTypesData.options];
    }


    return { tickets, ticketHeaders, teams, statuses, workTypes };
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    return { 
        tickets: [],
        ticketHeaders: [],
        teams: ['All'],
        statuses: ['All'],
        workTypes: ['All']
    };
  }
}

export default async function Home() {
  const { tickets, ticketHeaders, teams, statuses, workTypes } = await getDashboardData();

  return (
    <div className="bg-background flex-1">
        <main className="container mx-auto py-8 px-4 md:px-6">
            <div className="mt-8">
                <DashboardClient 
                    tickets={tickets} 
                    headers={ticketHeaders}
                    teams={teams}
                    statuses={statuses}
                    workTypes={workTypes}
                />
            </div>
        </main>
    </div>
  );
}
