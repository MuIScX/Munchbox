return (
  <div className="flex h-screen bg-[#f3f4f6] overflow-hidden">

    {/* Sidebar */}
    <div className="w-64 flex-shrink-0">
      <Sidebar />
    </div>

    {/* Main Content */}
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Scrollable Area */}
      <div className="p-6 overflow-y-auto">

        {/* Top Header Card */}
        <div className="bg-white rounded-2xl shadow-sm px-6 py-4 flex justify-between items-center mb-6 border border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-800">
            Manage Staff
          </h1>

          <button className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-6 py-2 rounded-xl transition">
            + Add New Staff
          </button>
        </div>

        {/* Total Staff Card */}
        <div className="bg-[#cfe3f1] w-72 rounded-2xl p-4 mb-4">
          <p className="text-[#2c6b8a] text-sm">Total Staff</p>
          <h2 className="text-3xl font-bold text-black">
            {staff.length}
          </h2>
        </div>

        {/* Role Filter */}
        <div className="bg-white rounded-2xl shadow-sm p-3 mb-6 border border-gray-200">
          <input
            type="text"
            placeholder="🔍 Role: all"
            className="w-64 bg-gray-100 rounded-lg px-4 py-2 outline-none text-gray-700"
          />
        </div>

        {/* Staff Table Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">

          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Manage Staff Accounts
          </h2>

          {/* Table Scroll */}
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full border-separate border-spacing-y-2 text-sm">

              <thead className="sticky top-0 bg-white z-10">
                <tr className="bg-[#e5e7eb] text-gray-700 text-left">
                  <th className="px-4 py-2 rounded-l-lg font-medium">
                    Staff Name
                  </th>
                  <th className="px-4 py-2 font-medium">
                    Role
                  </th>
                  <th className="px-4 py-2 rounded-r-lg font-medium">
                    Info
                  </th>
                </tr>
              </thead>

              <tbody>
                {staff.map((member) => (
                  <tr
                    key={member.id}
                    className="bg-white border-b border-gray-100 hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-2 text-gray-800">
                      {member.name}
                    </td>

                    <td className="px-4 py-2 text-gray-700">
                      {member.role}
                    </td>

                    <td className="px-4 py-2">
                      <span className="text-blue-500 hover:underline cursor-pointer">
                        Edit profile
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>

        </div>

      </div>
    </div>
  </div>
);