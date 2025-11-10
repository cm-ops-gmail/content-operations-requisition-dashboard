
import { getAllTickets, getWorkTypes, getTeams } from './actions';
import { DashboardClient } from '@/components/DashboardClient';
import { unstable_noStore as noStore } from 'next/cache';
import React from 'react';


async function getDashboardData() {
  noStore(); // This is the key change to prevent caching
  try {
    const [ticketData, teamsData, workTypesData] = await Promise.all([
        getAllTickets(), 
        getTeams(),
        getWorkTypes()
    ]);
    
    let tickets: string[][] = [];
    let ticketHeaders: string[] = [];
    let teams: string[] = [];
    let statuses: string[] = ["All", "In Review", "In Progress", "Prioritized", "On Hold", "Delivered", "Completed"];
    let workTypes: string[] = [];

    if (ticketData.values && ticketData.values.length > 0) {
        ticketHeaders = ticketData.values[0];
        tickets = ticketData.values.slice(1).reverse();
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
        statuses: ["All", "In Review", "In Progress", "Prioritized", "On Hold", "Delivered", "Completed"],
        workTypes: ['All']
    };
  }
}

// We create a new component to fetch and render the data.
// This isolates the dynamic data fetching.
async function Dashboard() {
    const { tickets, ticketHeaders, teams, statuses, workTypes } = await getDashboardData();
    return (
        <DashboardClient 
            tickets={tickets} 
            headers={ticketHeaders}
            teams={teams}
            statuses={statuses}
            workTypes={workTypes}
        />
    )
}

export default function Home() {
  return (
    <div className="bg-background flex-1">
        <main className="container mx-auto py-8 px-4 md:px-6">
            <div className="mt-8">
               <React.Suspense fallback={<p>Loading dashboard...</p>}>
                  <Dashboard />
               </React.Suspense>
            </div>
        </main>
    </div>
  );
}

    
