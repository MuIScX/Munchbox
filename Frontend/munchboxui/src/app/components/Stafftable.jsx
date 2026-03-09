return (
  <div className="flex h-screen bg-slate-50 overflow-hidden">

    {/* Sidebar */}
    <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white">
      <Sidebar />
    </div>

    {/* Main */}
    <div className="flex-1 flex flex-col overflow-hidden">

      <div className="p-8 overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Manage Staff
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage your restaurant team members
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-xl shadow-sm transition active:scale-95"
          >
            + Add Staff
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-orange-100 to-orange-50 border border-orange-200 rounded-2xl p-6 w-80">
            <p className="text-orange-600 text-sm font-medium">
              Total Staff Members
            </p>
            <h2 className="text-4xl font-bold text-slate-900 mt-2">
              {staff.length}
            </h2>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search staff by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-80 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm focus:ring-2 focus:ring-orange-400 outline-none"
          />
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">
              Staff Directory
            </h2>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">

              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr className="text-left text-slate-500 uppercase text-xs tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {filteredStaff.length > 0 ? (
                  filteredStaff.map((member) => (
                    <tr
                      key={member.id}
                      className="group hover:bg-slate-50 transition"
                    >
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {member.name}
                      </td>

                      <td className="px-6 py-4">
                        <span className="px-3 py-1 text-xs rounded-full bg-slate-100 text-slate-600">
                          {member.role || "Staff"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition">
                          <button className="text-blue-500 hover:text-blue-600 text-sm font-medium">
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(member.id)}
                            className="text-red-500 hover:text-red-600 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="text-center py-16 text-slate-400"
                    >
                      No staff members found.
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  </div>
);