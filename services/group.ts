import api from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { joinGroup } from "./socket";

export interface Group {
  groupID: string;
  groupName: string;
}

export interface GroupMember {
  groupID: string;
  userID: string;
  memberRole: "LEADER" | "MEMBER";
}

export const createGroup = async (data: { groupName: string; userID: string }): Promise<Group> => {
  try {
    const response = await api.post("/api/group", data);
    const groupData = response.data.group;

    // Lưu thông tin nhóm vào AsyncStorage
    const storedGroups = await AsyncStorage.getItem("userGroups");
    const groups: Group[] = storedGroups ? JSON.parse(storedGroups) : [];
    const newGroup: Group = { groupID: groupData.groupID, groupName: groupData.groupName };
    const groupExists = groups.some((g) => g.groupID === groupData.groupID);
    if (!groupExists) {
      groups.push(newGroup);
      await AsyncStorage.setItem("userGroups", JSON.stringify(groups));
      console.log("Đã lưu nhóm vào AsyncStorage:", newGroup);
    }

    return newGroup;
  } catch (error: any) {
    console.error("Lỗi khi tạo nhóm:", error.message);
    throw error;
  }
};

export const fetchUserGroups = async (userID: string): Promise<Group[]> => {
  try {
    const userGroupsResponse = await api.get(`/api/group/${userID}`);
    console.log("Dữ liệu từ API /api/group/:userID:", userGroupsResponse.data);
    if (!userGroupsResponse.data || !Array.isArray(userGroupsResponse.data)) {
      console.error("Dữ liệu trả về không phải mảng:", userGroupsResponse.data);
      return [];
    }

    const allGroupsResponse = await api.get(`/api/group`);
    const allGroups = allGroupsResponse.data.data || [];
    console.log("Dữ liệu từ API /api/group:", allGroups);

    const storedGroups = await AsyncStorage.getItem("userGroups");
    const localGroups: Group[] = storedGroups ? JSON.parse(storedGroups) : [];

    const groups = userGroupsResponse.data.map((item: { groupID: string }) => {
      const groupDetail = allGroups.find((g: { groupID: string }) => g.groupID === item.groupID);
      const localGroup = localGroups.find((g) => g.groupID === item.groupID);

      return {
        groupID: item.groupID,
        groupName: groupDetail?.groupName || localGroup?.groupName || "Nhóm không tên",
      };
    });

    console.log("Danh sách nhóm sau khi kết hợp:", groups);
    return groups;
  } catch (error: any) {
    console.error("Lỗi khi lấy danh sách nhóm:", error.message);
    const storedGroups = await AsyncStorage.getItem("userGroups");
    const localGroups: Group[] = storedGroups ? JSON.parse(storedGroups) : [];
    return localGroups;
  }
};

export const fetchGroupMembers = async (groupID: string): Promise<GroupMember[]> => {
  try {
    const response = await api.get(`/api/group/users/${groupID}`);
    return response.data.data || [];
  } catch (error: any) {
    console.error("Lỗi khi lấy thành viên nhóm:", error.message);
    return [];
  }
};