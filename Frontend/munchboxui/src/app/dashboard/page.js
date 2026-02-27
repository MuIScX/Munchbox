"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getCookie, setCookie } from 'cookies-next';
import { AuthAPI } from "@/lib/api"
import Sidebar from "../components/Sidebar";

export default function Home() {









  return (
 <div className="grid grid-cols-5 grid-rows-5 gap-4">
    <div className="col-span-1 row-span-5 ">

        <Sidebar/>
        </div>

        </div>

  );
}