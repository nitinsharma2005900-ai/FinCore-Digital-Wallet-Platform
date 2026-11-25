// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import {DataTable,ActionForm} from '../../apps/web/app/workspace';
afterEach(cleanup);
it('filters records and paginates results without losing record details',()=>{render(<DataTable rows={Array.from({length:12},(_,i)=>({id:'id-'+i,name:'Customer '+i}))}/>);expect(screen.getByText('Page 1 of 2 · 12 records')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Next'}));expect(screen.getByText('Page 2 of 2 · 12 records')).toBeTruthy();fireEvent.change(screen.getByLabelText('Search records'),{target:{value:'Customer 7'}});expect(screen.getAllByText('Customer 7').length).toBeGreaterThan(0);expect(screen.getByText('Page 1 of 1 · 1 records')).toBeTruthy();});
it('shows a safe server error and allows correction',async()=>{render(<ActionForm title="Resolve alert" fields={[{name:'resolution',label:'Resolution'}]} onSubmit={async()=>{throw Error('Resolution requires ten characters');}}/>);fireEvent.change(screen.getByLabelText('Resolution'),{target:{value:'short'}});fireEvent.click(screen.getByRole('button',{name:'Confirm action'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('ten characters'));});
